#!/usr/bin/env python3
"""Turn the web version's model assets into compact data for the Roblox version.

Reads public/games/thedilligentshadow/assets/{figure-woman,chair,right-hand}.js and writes
roblox/src/assets/{Figure,Chair,Hand}.luau: ModuleScripts holding base64 blobs plus the measurements
exhibit.js takes from the models at load (leg lengths, shoe outline, seat height ...).

Figure and hand: every node's rest transform (rigid local position + rotation, the model's scale baked in),
the rest-pose skinned vertices (welded, two strongest bone influences) and the triangles.
Chair: the stage-local vertices after exhibit.js's fitChairSeat (legs shortened, flattened in depth).
"""
import base64, json, math, os, re, struct

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
ASSETS = os.path.join(ROOT, 'public/games/thedilligentshadow/assets')
OUT = os.path.join(ROOT, 'roblox/src/assets')

FIG_H, PERSON_H = 0.56, 1.6
CHAIR_X = -0.78

# ---------- small linear algebra (row-major 4x4) ----------
def mmul(a, b):
    return [[sum(a[i][k] * b[k][j] for k in range(4)) for j in range(4)] for i in range(4)]
def mvec(m, v):
    return [m[i][0] * v[0] + m[i][1] * v[1] + m[i][2] * v[2] + m[i][3] for i in range(3)]
def ident():
    return [[1.0 if i == j else 0.0 for j in range(4)] for i in range(4)]
def quat_mat(q):
    x, y, z, w = q
    return [[1 - 2 * (y * y + z * z), 2 * (x * y - z * w), 2 * (x * z + y * w)],
            [2 * (x * y + z * w), 1 - 2 * (x * x + z * z), 2 * (y * z - x * w)],
            [2 * (x * z - y * w), 2 * (y * z + x * w), 1 - 2 * (x * x + y * y)]]
def mat_quat(m):
    t = m[0][0] + m[1][1] + m[2][2]
    if t > 0:
        s = math.sqrt(t + 1) * 2
        return [(m[2][1] - m[1][2]) / s, (m[0][2] - m[2][0]) / s, (m[1][0] - m[0][1]) / s, 0.25 * s]
    if m[0][0] > m[1][1] and m[0][0] > m[2][2]:
        s = math.sqrt(1 + m[0][0] - m[1][1] - m[2][2]) * 2
        return [0.25 * s, (m[0][1] + m[1][0]) / s, (m[0][2] + m[2][0]) / s, (m[2][1] - m[1][2]) / s]
    if m[1][1] > m[2][2]:
        s = math.sqrt(1 + m[1][1] - m[0][0] - m[2][2]) * 2
        return [(m[0][1] + m[1][0]) / s, 0.25 * s, (m[1][2] + m[2][1]) / s, (m[0][2] - m[2][0]) / s]
    s = math.sqrt(1 + m[2][2] - m[0][0] - m[1][1]) * 2
    return [(m[0][2] + m[2][0]) / s, (m[1][2] + m[2][1]) / s, 0.25 * s, (m[1][0] - m[0][1]) / s]
def trs(t, r, s):
    R = quat_mat(r)
    return [[R[i][0] * s[0], R[i][1] * s[1], R[i][2] * s[2], t[i]] for i in range(3)] + [[0, 0, 0, 1]]
def sub(a, b): return [a[i] - b[i] for i in range(3)]
def dot(a, b): return sum(a[i] * b[i] for i in range(3))
def norm(a):
    l = math.sqrt(dot(a, a)); return [x / l for x in a]
def cross(a, b): return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]
def dist(a, b): return math.sqrt(dot(sub(a, b), sub(a, b)))
def lerp(a, b, k): return a + (b - a) * k

def rigid(m):
    """Split a world matrix with uniform scale into (position, 3x3 rotation, scale)."""
    cols = [[m[i][j] for i in range(3)] for j in range(3)]
    s = [math.sqrt(dot(c, c)) for c in cols]
    assert max(s) - min(s) < 1e-4 * max(s), ('non-uniform scale', s)
    R = [[m[i][j] / s[j] for j in range(3)] for i in range(3)]
    return [m[i][3] for i in range(3)], R, s[0]
def rT(R): return [[R[j][i] for j in range(3)] for i in range(3)]
def rmul(a, b): return [[sum(a[i][k] * b[k][j] for k in range(3)) for j in range(3)] for i in range(3)]
def rvec(R, v): return [sum(R[i][k] * v[k] for k in range(3)) for i in range(3)]

# ---------- glTF ----------
def load_glb(fn, var):
    s = open(os.path.join(ASSETS, fn)).read()
    b = base64.b64decode(re.search(var + r'\s*=\s*"([^"]+)"', s).group(1))
    jl = struct.unpack('<I', b[12:16])[0]
    j = json.loads(b[20:20 + jl])
    off = 20 + jl
    bl = struct.unpack('<I', b[off:off + 4])[0]
    return j, b[off + 8:off + 8 + bl]

CT = {5120: 'b', 5121: 'B', 5122: 'h', 5123: 'H', 5125: 'I', 5126: 'f'}
NC = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3, 'VEC4': 4, 'MAT4': 16}
def accessor(j, binb, i):
    a = j['accessors'][i]
    bv = j['bufferViews'][a['bufferView']]
    fmt, n = CT[a['componentType']], NC[a['type']]
    size = struct.calcsize('<' + fmt)
    stride = bv.get('byteStride') or size * n
    base = bv.get('byteOffset', 0) + a.get('byteOffset', 0)
    out = []
    for k in range(a['count']):
        vals = struct.unpack_from('<' + fmt * n, binb, base + k * stride)
        if a.get('normalized'):
            d = {'B': 255.0, 'H': 65535.0, 'b': 127.0, 'h': 32767.0}[fmt]
            vals = tuple(v / d for v in vals)
        out.append(vals if n > 1 else vals[0])
    return out

def node_worlds(j):
    nodes = j['nodes']
    parent = [-1] * len(nodes)
    for i, n in enumerate(nodes):
        for c in n.get('children', []): parent[c] = i
    local = []
    for n in nodes:
        if 'matrix' in n:
            m = n['matrix']; local.append([[m[c * 4 + r] for c in range(4)] for r in range(4)])
        else:
            local.append(trs(n.get('translation', [0, 0, 0]), n.get('rotation', [0, 0, 0, 1]), n.get('scale', [1, 1, 1])))
    world = [None] * len(nodes)
    def w(i):
        if world[i] is None: world[i] = local[i] if parent[i] < 0 else mmul(w(parent[i]), local[i])
        return world[i]
    for i in range(len(nodes)): w(i)
    return parent, world

def skinned_rest(j, binb, world):
    """Bind-pose skinned vertices of every skinned primitive, in scene space, with their 4 joint node ids/weights."""
    verts, tris = [], []
    for ni, n in enumerate(j['nodes']):
        if 'mesh' not in n or 'skin' not in n: continue
        skin = j['skins'][n['skin']]
        ibm = accessor(j, binb, skin['inverseBindMatrices'])
        ibm = [[[m[c * 4 + r] for c in range(4)] for r in range(4)] for m in ibm]
        jm = [mmul(world[jn], ibm[k]) for k, jn in enumerate(skin['joints'])]
        for prim in j['meshes'][n['mesh']]['primitives']:
            at = prim['attributes']
            P = accessor(j, binb, at['POSITION']); J = accessor(j, binb, at['JOINTS_0']); W = accessor(j, binb, at['WEIGHTS_0'])
            idx = accessor(j, binb, prim['indices'])
            base = len(verts)
            for p, jj, ww in zip(P, J, W):
                s = sum(ww); v = [0, 0, 0]
                for k in range(4):
                    if ww[k] <= 0: continue
                    q = mvec(jm[jj[k]], p)
                    for c in range(3): v[c] += q[c] * ww[k] / s
                verts.append({'p': v, 'j': [skin['joints'][x] for x in jj], 'w': [x / s for x in ww]})
            for t in range(0, len(idx), 3): tris.append((base + idx[t], base + idx[t + 1], base + idx[t + 2]))
    return verts, tris

def best_bone(v):
    k = max(range(4), key=lambda i: v['w'][i]); return v['j'][k]

def weld(verts, tris):
    """Merge vertices at the same place on the same bones; keep the two strongest influences."""
    key2i, out, remap = {}, [], []
    for v in verts:
        order = sorted(range(4), key=lambda i: -v['w'][i])
        j1, j2 = v['j'][order[0]], v['j'][order[1]]
        w1, w2 = v['w'][order[0]], v['w'][order[1]]
        if w2 <= 0: j2 = j1
        w1 = w1 / (w1 + w2) if w1 + w2 > 0 else 1
        k = (round(v['p'][0], 6), round(v['p'][1], 6), round(v['p'][2], 6), j1, j2)
        if k not in key2i:
            key2i[k] = len(out); out.append({'p': v['p'], 'j1': j1, 'j2': j2, 'w1': w1})
        remap.append(key2i[k])
    t2 = []
    for a, b, c in tris:
        a, b, c = remap[a], remap[b], remap[c]
        if a != b and b != c and a != c: t2.append((a, b, c))
    return out, t2

def b64(data): return base64.b64encode(data).decode()

def write_module(name, header, fields):
    os.makedirs(OUT, exist_ok=True)
    lines = ['-- ' + l for l in header] + ['-- Generated by roblox/tools/prepare_assets.py. Do not edit.', 'return {']
    for k, v in fields:
        if isinstance(v, str) and v.startswith('__raw__'): lines.append(f'\t{k} = {v[7:]},')
        elif isinstance(v, str): lines.append(f'\t{k} = "{v}",')
        else: lines.append(f'\t{k} = {lua(v)},')
    lines.append('}')
    open(os.path.join(OUT, name + '.luau'), 'w').write('\n'.join(lines) + '\n')

def lua(v):
    if isinstance(v, bool): return 'true' if v else 'false'
    if isinstance(v, (int,)): return str(v)
    if isinstance(v, float): return repr(round(v, 7))
    if isinstance(v, str): return json.dumps(v)
    if isinstance(v, (list, tuple)): return '{' + ', '.join(lua(x) for x in v) + '}'
    if isinstance(v, dict): return '{' + ', '.join(f'[{json.dumps(k)}] = {lua(x)}' if not re.match(r'^[A-Za-z_]\w*$', k) else f'{k} = {lua(x)}' for k, x in v.items()) + '}'
    raise TypeError(v)

def pack_rig(names, parent, wpos, wrot):
    """Nodes as rigid local transforms: parent index (0-based, -1 = root), local position, local rotation quaternion."""
    pos, rot = [], []
    for i in range(len(names)):
        if parent[i] < 0: lp, lr = wpos[i], wrot[i]
        else:
            pr = wrot[parent[i]]
            lp = rvec(rT(pr), sub(wpos[i], wpos[parent[i]]))
            lr = rmul(rT(pr), wrot[i])
        pos += lp; rot += mat_quat(lr)
    return struct.pack('<%df' % len(pos), *pos), struct.pack('<%df' % len(rot), *rot)

def pack_mesh(verts, tris):
    vb = bytearray()
    for v in verts:
        vb += struct.pack('<3fBBB', v['p'][0], v['p'][1], v['p'][2], v['j1'], v['j2'], max(0, min(255, round(v['w1'] * 255))))
    tb = struct.pack('<%dH' % (len(tris) * 3), *[i for t in tris for i in t])
    return bytes(vb), tb

# ---------- the figure ----------
def figure():
    j, binb = load_glb('figure-woman.js', 'FIGURE_GLB_B64')
    parent, world = node_worlds(j)
    names = [n.get('name', f'node{i}') for i, n in enumerate(j['nodes'])]
    nid = {re.sub(r'[^A-Za-z0-9_]', '', n): i for i, n in enumerate(names)}
    bn = lambda n: nid[re.sub(r'[^A-Za-z0-9_]', '', n)]
    verts, tris = skinned_rest(j, binb, world)
    P0 = lambda n: [world[bn(n)][i][3] for i in range(3)]
    # exhibit.js setupFigure: scale to a 56 cm shadow person, hips centred in depth, the left sole 7 mm up
    h0 = P0('Head_end')[1] - P0('Foot.L')[1]
    k = FIG_H / h0
    hz = (P0('UpperLeg.L')[2] + P0('UpperLeg.R')[2]) / 2 * k
    fy = P0('Foot.L')[1] * k - 0.007
    off = [0, -fy, -hz]
    M = [[k, 0, 0, off[0]], [0, k, 0, off[1]], [0, 0, k, off[2]], [0, 0, 0, 1]]
    world = [mmul(M, w) for w in world]
    for v in verts: v['p'] = [v['p'][i] * k + off[i] for i in range(3)]
    wpos, wrot = [], []
    for w in world:
        p, R, _ = rigid(w); wpos.append(p); wrot.append(R)
    P = lambda n: wpos[bn(n)]
    # measurements (exhibit.js setupFigure)
    L1 = (dist(P('UpperLeg.L'), P('LowerLeg.L')) + dist(P('UpperLeg.R'), P('LowerLeg.R'))) / 2
    L2 = (dist(P('LowerLeg.L'), P('LowerLeg.L_end')) + dist(P('LowerLeg.R'), P('LowerLeg.R_end'))) / 2
    UA = dist(P('UpperArm.L'), P('LowerArm.L')); FA = dist(P('LowerArm.L'), P('Wrist.L'))
    lat = {s: {'hip': P('UpperLeg.' + s)[0], 'sh': P('UpperArm.' + s)[0]} for s in 'LR'}
    shoe = {}
    for s in 'LR':
        ankle = P('Foot.' + s); ids = {bn('Foot.' + s), bn('PT.' + s)}
        heel = toe = sole = tipY = 0
        for v in verts:
            if best_bone(v) not in ids: continue
            r = sub(v['p'], ankle)
            heel = min(heel, r[2]); sole = min(sole, r[1])
            if r[2] > toe: toe, tipY = r[2], r[1]
        shoe[s] = (heel, toe, sole, tipY)
    torso = {bn(n) for n in ['Body', 'Hips', 'Abdomen', 'Torso', 'Chest', 'Neck', 'Shoulder.L', 'Shoulder.R', 'UpperLeg.L', 'UpperLeg.R'] if re.sub(r'[^A-Za-z0-9_]', '', n) in nid}
    hip, knee = P('UpperLeg.L'), P('LowerLeg.L')
    back = 0
    for v in verts:
        if best_bone(v) not in torso: continue
        q = v['p']; kk = (hip[1] - q[1]) / (hip[1] - knee[1])
        if kk < 0.15 or kk > 0.6 or (q[0] > 0) != (hip[0] > 0): continue
        back = max(back, lerp(hip[2], knee[2], kk) - q[2])
    ANKLE_H = -min(shoe['L'][2], shoe['R'][2])
    FOOTS = {s: {'heel': [shoe[s][0] + 0.002, -ANKLE_H], 'toe': [shoe[s][1] - 0.006, -ANKLE_H], 'tip': [shoe[s][1], max(shoe[s][3], -ANKLE_H + 0.002)]} for s in 'LR'}
    wv, wt = weld(verts, tris)
    vb, tb = pack_mesh(wv, wt)
    pb, rb = pack_rig(names, parent, wpos, wrot)
    print(f'figure: {len(names)} nodes, {len(verts)}→{len(wv)} verts, {len(tris)}→{len(wt)} tris, L1={L1:.4f} L2={L2:.4f} ANKLE_H={ANKLE_H:.4f} thighBack={back:.4f}')
    write_module('Figure', ['"Animated Woman" by Quaternius (quaternius.com), CC0. Rest pose in stage metres, facing +z.'], [
        ('names', [re.sub(r'[^A-Za-z0-9_]', '', n) for n in names]), ('parent', parent),
        ('pos', b64(pb)), ('rot', b64(rb)), ('verts', b64(vb)), ('tris', b64(tb)),
        ('L1', L1), ('L2', L2), ('UA', UA), ('FA', FA), ('ANKLE_H', ANKLE_H), ('thighBack', back),
        ('lat', lat), ('FOOTS', FOOTS),
    ])
    return {'L2': L2, 'ANKLE_H': ANKLE_H, 'thighBack': back}

# ---------- the chair (exhibit.js chair + fitChairSeat, done once here) ----------
def chair(fm):
    s = open(os.path.join(ASSETS, 'chair.js')).read()
    pos = struct.unpack('<%df' % (len(base64.b64decode(re.search(r'positions:\s*"([^"]+)"', s).group(1))) // 4),
                        base64.b64decode(re.search(r'positions:\s*"([^"]+)"', s).group(1)))
    ib = base64.b64decode(re.search(r'indices:\s*"([^"]+)"', s).group(1))
    idx = struct.unpack('<%dH' % (len(ib) // 2), ib)
    P = [list(pos[i:i + 3]) for i in range(0, len(pos), 3)]
    hist = {}
    for p in P:
        if 0.5 < p[1] < 0.7: kk = round(p[1] * 100); hist[kk] = hist.get(kk, 0) + 1
    seat = max(hist.items(), key=lambda e: e[1])[0] / 100
    SIT_HIP = fm['ANKLE_H'] + fm['L2'] * 0.985
    target = SIT_HIP - fm['thighBack'] - 0.002
    kk = FIG_H / PERSON_H; want = target / kk
    below = seat - 0.04; f = (want - 0.04) / below
    out = []
    for x, y, z in P:
        y = y * f if y < below else y - below * (1 - f)
        x, y, z = x * kk * 0.04, y * kk, z * kk          # chair.scale = k, then x *= 0.04 (local x: flattened in depth)
        out.append([CHAIR_X + z, y, -x])                 # rotation.y = π/2: local (x, z) → (z, -x)
    SEAT_Y = want * kk
    xs = [p[0] for p in out if abs(p[1] - SEAT_Y) < 0.006]
    front, back = max(xs), min(xs)
    vb = struct.pack('<%df' % (len(out) * 3), *[c for p in out for c in p])
    tb = struct.pack('<%dH' % len(idx), *idx)
    print(f'chair: {len(out)} verts, {len(idx) // 3} tris, seat {SEAT_Y:.4f} m, front {front:.4f} back {back:.4f}')
    write_module('Chair', ['"Painted Wooden Chair 02" by Kirill Sannikov, Poly Haven, CC0. Stage metres, legs fitted to her seat.'], [
        ('verts', b64(vb)), ('tris', b64(tb)), ('SEAT_Y', SEAT_Y), ('front', front), ('back', back), ('SIT_HIP', SIT_HIP),
    ])

# ---------- the visitor's hand ----------
CHAINS = {
    'thumb': ['thumb-metacarpal', 'thumb-phalanx-proximal', 'thumb-phalanx-distal', 'thumb-tip'],
    'index': ['index-finger-metacarpal', 'index-finger-phalanx-proximal', 'index-finger-phalanx-intermediate', 'index-finger-phalanx-distal', 'index-finger-tip'],
    'middle': ['middle-finger-metacarpal', 'middle-finger-phalanx-proximal', 'middle-finger-phalanx-intermediate', 'middle-finger-phalanx-distal', 'middle-finger-tip'],
    'ring': ['ring-finger-metacarpal', 'ring-finger-phalanx-proximal', 'ring-finger-phalanx-intermediate', 'ring-finger-phalanx-distal', 'ring-finger-tip'],
    'pinky': ['pinky-finger-metacarpal', 'pinky-finger-phalanx-proximal', 'pinky-finger-phalanx-intermediate', 'pinky-finger-phalanx-distal', 'pinky-finger-tip'],
}
def hand():
    j, binb = load_glb('right-hand.js', 'HAND_GLB_B64')
    _, world = node_worlds(j)
    names = [n.get('name') for n in j['nodes']]
    verts, tris = skinned_rest(j, binb, world)
    # the joints import as siblings: chain each finger under the wrist (exhibit.js setupHand)
    bones = ['wrist'] + [b for c in CHAINS.values() for b in c if b in names]
    par = {'wrist': None}
    for c in CHAINS.values():
        p = 'wrist'
        for b in c:
            if b in names: par[b] = p; p = b
    wpos, wrot = [], []
    for b in bones:
        p, R, sc = rigid(world[names.index(b)]); wpos.append(p); wrot.append(R)
    parent = [-1 if par[b] is None else bones.index(par[b]) for b in bones]
    node2bone = {names.index(b): i for i, b in enumerate(bones)}
    for v in verts: v['j'] = [node2bone[x] for x in v['j']]
    wv, wt = weld(verts, tris)
    # texture coordinates for the wrist fade: u along the hand toward the wrist (metres from the wrist, -0.07..+0.03),
    # v across the knuckles; a dither texture over (u, v) fades the skin and its shadow out at the open edge
    W = wpos[bones.index('wrist')]; K = wpos[bones.index('middle-finger-metacarpal')]
    d = norm(sub(W, K))
    acr = sub(wpos[bones.index('index-finger-metacarpal')], wpos[bones.index('pinky-finger-metacarpal')])
    acr = norm(sub(acr, [x * dot(acr, d) for x in d]))
    U0, U1, V0, V1 = -0.07, 0.03, -0.08, 0.08
    uv = bytearray()
    for v in wv:
        r = sub(v['p'], W)
        uv += struct.pack('<2f', (dot(r, d) - U0) / (U1 - U0), (dot(r, acr) - V0) / (V1 - V0))
    vb, tb = pack_mesh(wv, wt)
    pb, rb = pack_rig(bones, parent, wpos, wrot)
    print(f'hand: {len(bones)} bones, {len(verts)}→{len(wv)} verts, {len(wt)} tris')
    write_module('Hand', ['WebXR Input Profiles generic hand (right.glb), MIT License, Copyright (c) 2019 Amazon.',
                          'Rest pose in metres; uv spans u = -0.07..0.03 m along knuckle→wrist, v = -0.08..0.08 m across.'], [
        ('names', bones), ('parent', parent), ('pos', b64(pb)), ('rot', b64(rb)), ('verts', b64(vb)), ('tris', b64(tb)),
        ('uv', b64(bytes(uv))), ('U0', U0), ('U1', U1),
    ])

if __name__ == '__main__':
    fm = figure()
    chair(fm)
    hand()
