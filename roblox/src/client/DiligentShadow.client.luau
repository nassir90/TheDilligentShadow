--!native
-- The Diligent Shadow, for Roblox: an homage to Koya Endo's installation (Tokyo Prototype 2026).
-- A port of public/games/thedilligentshadow/exhibit.js. In the web version the figure, her chair and the
-- visitor's hand are 3D models lit by one lamp, and what you see on the wall are their real shadows. Here each
-- model is skinned on the CPU every frame and its vertices are projected through the lamp onto the wall, into an
-- EditableMesh: the same silhouette, drawn flat. Runs on each player's client: everyone gets their own shadow.
-- Units: metres (as exhibit.js) everywhere, converted to studs (Geo.S) only where parts are placed.

local Players = game:GetService("Players")
local RunService = game:GetService("RunService")
local UIS = game:GetService("UserInputService")
local AssetService = game:GetService("AssetService")

local player = Players.LocalPlayer
local DS = game.ReplicatedStorage:WaitForChild("DiligentShadow")
local Geo = require(DS:WaitForChild("Geometry"))
local Env = require(DS:WaitForChild("Environment"))
local AssetsF = DS:WaitForChild("Assets")
local FigData = require(AssetsF:WaitForChild("Figure"))
local ChairData = require(AssetsF:WaitForChild("Chair"))
local HandData = require(AssetsF:WaitForChild("Hand"))

local Gallery = workspace:WaitForChild("Gallery")
local swModel = Gallery:WaitForChild("Switch")
local pivotPart = swModel:WaitForChild("Pivot")
local grabPart = swModel:WaitForChild("Grab")
local plinthPart = Gallery:WaitForChild("Plinth")
local beam = Gallery:WaitForChild("Lamp"):WaitForChild("Beam")
local downLight = Gallery:WaitForChild("Downlight"):WaitForChild("Light")
local BEAM_I, DOWN_I = beam.Brightness, downLight.Brightness
local setLamp = Env.paint(Gallery)
local leverPart, shadeSwitch = require(DS:WaitForChild("Switch"))(Gallery)

local SCALE, WALL_Z, PLINTH, SW, LAMP, LEDGE_Y = Geo.S, Geo.WALL_Z, Geo.PLINTH, Geo.SW, Geo.LAMP, Geo.LEDGE_Y
local clamp, abs, sin, cos, sqrt, pi, max, min = math.clamp, math.abs, math.sin, math.cos, math.sqrt, math.pi, math.max, math.min
local function lerp(a, b, k) return a + (b - a) * k end
local function ss(k) k = clamp(k, 0, 1); return k * k * (3 - 2 * k) end
local function rand(a, b) return a + math.random() * (b - a) end
local function sign(x) return x > 0 and 1 or x < 0 and -1 or 0 end
local V3 = Vector3.new
-- every shadow is the colour of the wall where no lamp light reaches (Environment.luau paints the wall)
-- (set dimmer than DARK: Neon shows a colour about 1.75 times brighter, and a shadow must match the unlit wall
-- exactly, so it can stay drawn and emerge as the lamp's pool brightens around it)
local SHADOW = Color3.new(Env.DARK.R / 1.75, Env.DARK.G / 1.75, Env.DARK.B / 1.75)
local SHADOW_MATERIAL = Enum.Material.Neon   -- unlit: a shadow takes no highlight from the lamp

-- ---------- data ----------
local B64 = {}
do
	local chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/"
	for i = 1, 64 do B64[string.byte(chars, i)] = i - 1 end
end
local function unb64(s)
	local n = #s
	local pad = (string.sub(s, -2) == "==") and 2 or (string.sub(s, -1) == "=") and 1 or 0
	local len = n // 4 * 3 - pad
	local out = buffer.create(len)
	local o = 0
	for i = 1, n, 4 do
		local a, b, c, d = string.byte(s, i, i + 3)
		local v = B64[a] * 262144 + B64[b] * 4096 + (B64[c] or 0) * 64 + (B64[d] or 0)
		buffer.writeu8(out, o, v // 65536); o += 1
		if o < len then buffer.writeu8(out, o, (v // 256) % 256); o += 1 end
		if o < len then buffer.writeu8(out, o, v % 256); o += 1 end
	end
	return out
end

-- a node hierarchy with rigid local transforms; world[i] is the node's frame in its root's space
local function newRig(data)
	local pb, rb = unb64(data.pos), unb64(data.rot)
	local rig = { n = #data.names, names = data.names, parent = {}, children = {}, idx = {}, restPos = {}, restRot = {}, pos = {}, rot = {}, world = {}, rootCF = CFrame.identity }
	for i = 1, rig.n do
		rig.idx[data.names[i]] = i
		rig.parent[i] = data.parent[i] + 1   -- 0 = root
		rig.children[i] = {}
		local o = (i - 1) * 12
		rig.restPos[i] = V3(buffer.readf32(pb, o), buffer.readf32(pb, o + 4), buffer.readf32(pb, o + 8))
		local q = (i - 1) * 16
		rig.restRot[i] = CFrame.new(0, 0, 0, buffer.readf32(rb, q), buffer.readf32(rb, q + 4), buffer.readf32(rb, q + 8), buffer.readf32(rb, q + 12))
		rig.pos[i], rig.rot[i] = rig.restPos[i], rig.restRot[i]
	end
	rig.roots = {}
	for i = 1, rig.n do
		local p = rig.parent[i]
		if p > 0 then table.insert(rig.children[p], i) else table.insert(rig.roots, i) end
	end
	return rig
end
local function updateNode(rig, i)
	local p = rig.parent[i]
	rig.world[i] = (p > 0 and rig.world[p] or rig.rootCF) * CFrame.new(rig.pos[i]) * rig.rot[i]
	for _, c in rig.children[i] do updateNode(rig, c) end
end
local function updateRig(rig) for _, r in rig.roots do updateNode(rig, r) end end
local function resetRig(rig) for i = 1, rig.n do rig.pos[i], rig.rot[i] = rig.restPos[i], rig.restRot[i] end end

-- skinned vertices: each one's rest position held in its two bones' frames
local function newSkin(rig, data)
	local vb, tb = unb64(data.verts), unb64(data.tris)
	local nv, nt = buffer.len(vb) // 15, buffer.len(tb) // 6
	updateRig(rig)
	local sk = { nv = nv, j1 = table.create(nv), j2 = table.create(nv), w1 = table.create(nv), o1 = table.create(nv), o2 = table.create(nv), rest = table.create(nv), tris = table.create(nt * 3) }
	for i = 1, nv do
		local o = (i - 1) * 15
		local p = V3(buffer.readf32(vb, o), buffer.readf32(vb, o + 4), buffer.readf32(vb, o + 8))
		local j1, j2 = buffer.readu8(vb, o + 12) + 1, buffer.readu8(vb, o + 13) + 1
		sk.rest[i] = p
		sk.j1[i], sk.j2[i], sk.w1[i] = j1, j2, buffer.readu8(vb, o + 14) / 255
		sk.o1[i] = rig.world[j1]:PointToObjectSpace(p)
		sk.o2[i] = rig.world[j2]:PointToObjectSpace(p)
	end
	for i = 0, nt * 3 - 1 do sk.tris[i + 1] = buffer.readu16(tb, i * 2) + 1 end
	return sk
end
local function skinVertex(rig, sk, i)
	local w = sk.w1[i]
	local a = rig.world[sk.j1[i]] * sk.o1[i]
	if w >= 0.999 then return a end
	return a * w + (rig.world[sk.j2[i]] * sk.o2[i]) * (1 - w)
end

-- ---------- flat meshes on the wall ----------
-- An EditableMesh in a MeshPart at the wall; vertices are placed in wall metres (x, y absolute) × SCALE. Two
-- far-apart anchor triangles pin its bounds, so the MeshPart's centre is the mesh origin at a 1:1 scale.
local WALL_STUDS = WALL_Z * SCALE
-- shadows stand a little off the wall: the wall's painted pool (a SurfaceGui) draws slightly in front of its surface
local OFF = 0.1
local wallFolder = Instance.new("Folder")
wallFolder.Name = "Shadows"
wallFolder.Parent = workspace
local shadowParts = {}
local function newFlatMesh(name, depth, layer)
	local em = AssetService:CreateEditableMesh()
	local Bd = 60
	for _, s in { -1, 1 } do
		local a = em:AddVertex(V3(s * Bd, s * Bd, s * 0.01))
		em:AddTriangle(a, em:AddVertex(V3(s * Bd, s * Bd, s * 0.01)), em:AddVertex(V3(s * Bd, s * Bd, s * 0.01)))
	end
	return em, function()
		local mp = AssetService:CreateMeshPartAsync(Content.fromObject(em))
		mp.Name = name
		mp.Anchored, mp.CanCollide, mp.CanQuery, mp.CanTouch, mp.CastShadow = true, false, false, false, false
		mp.Material = SHADOW_MATERIAL
		mp.Color = SHADOW
		mp.CFrame = CFrame.new(0, 0, depth or (WALL_STUDS + OFF + (layer or 0) * 0.002))
		mp.Parent = wallFolder
		table.insert(shadowParts, mp)
		return mp
	end
end
-- triangles both ways round, so the silhouette shows whichever way it was wound; all facing the room
local function addFaces(em, ids, tris, uvIds)
	local n = em:AddNormal(V3(0, 0, 1))
	for t = 1, #tris, 3 do
		local a, b, c = ids[tris[t]], ids[tris[t + 1]], ids[tris[t + 2]]
		for _, f in { em:AddTriangle(a, b, c), em:AddTriangle(a, c, b) } do
			em:SetFaceNormals(f, { n, n, n })
		end
	end
end
local function wallPoint(x, y) return V3(x * SCALE, y * SCALE, 0) end
-- a stage-local point → its shadow on the wall (absolute wall metres)
local SP, SK = Geo.STAGE_POS, Geo.stageK
local LX, LY, LZ = LAMP.X, LAMP.Y, LAMP.Z
local function stageShadow(p)
	local wx, wy, wz = SP.X + p.X / SK, SP.Y + p.Y / SK, SP.Z + p.Z / SK
	local t = (WALL_Z - LZ) / (wz - LZ)
	return LX + (wx - LX) * t, LY + (wy - LY) * t
end
local function worldShadow(p)   -- a world point (metres) → its shadow on the wall (absolute wall metres)
	local t = (WALL_Z - LZ) / (p.Z - LZ)
	return LX + (p.X - LX) * t, LY + (p.Y - LY) * t
end

-- the plinth's shadow: the ledge she lives on (the lamp is below the plinth's top, so its front top edge casts it)
do
	local half = PLINTH.size / 2 * Geo.ratio(Geo.FRONT_Z)
	local ledge = Instance.new("Part")
	ledge.Name = "Ledge"
	ledge.Anchored, ledge.CanCollide, ledge.CanQuery, ledge.CanTouch, ledge.CastShadow = true, false, false, false, false
	ledge.Material, ledge.Color = SHADOW_MATERIAL, SHADOW
	ledge.Size = V3(2 * half * SCALE, LEDGE_Y * SCALE, 0.02)
	ledge.Position = V3(PLINTH.x * SCALE, LEDGE_Y * SCALE / 2, WALL_STUDS + OFF + 0.002)
	ledge.Parent = wallFolder
	table.insert(shadowParts, ledge)
end

-- One flat mesh holds every opaque shadow on the wall (her chair, her, the visitor's hand): runtime meshes are
-- limited in number, and these all share a colour.
local wallEm, makeWall = newFlatMesh("WallShadows", nil, 2)

-- ---------- the chair (static) ----------
do
	local vb, tb = unb64(ChairData.verts), unb64(ChairData.tris)
	local em = wallEm
	local ids = {}
	for i = 1, buffer.len(vb) // 12 do
		local o = (i - 1) * 12
		local x, y = stageShadow(V3(buffer.readf32(vb, o), buffer.readf32(vb, o + 4), buffer.readf32(vb, o + 8)))
		ids[i] = em:AddVertex(wallPoint(x, y))
	end
	local tris = {}
	for i = 0, buffer.len(tb) // 2 - 1 do tris[i + 1] = buffer.readu16(tb, i * 2) + 1 end
	addFaces(em, ids, tris)
end

-- ---------- the figure: "Animated Woman", Quaternius, CC0 ----------
local rig = newRig(FigData)
local function bn(n) return rig.idx[(string.gsub(n, "[^%w_]", ""))] end
local figSkin = newSkin(rig, FigData)
local figEm = wallEm
local figIds = table.create(figSkin.nv)
for i = 1, figSkin.nv do figIds[i] = figEm:AddVertex(V3(0, 0, 0)) end
addFaces(figEm, figIds, figSkin.tris)

local L1, L2, UA, FA, ANKLE_H = FigData.L1, FigData.L2, FigData.UA, FigData.FA, FigData.ANKLE_H
local LAT = FigData.lat
local FOOTS = { L = FigData.FOOTS.L, R = FigData.FOOTS.R }
local FOOT = FOOTS.L
local HAND = "Wrist"
local restWorld = {}
for i = 1, rig.n do restWorld[i] = rig.world[i] end
local footRest = { L = restWorld[bn("Foot.L")].Rotation, R = restWorld[bn("Foot.R")].Rotation }
local bodyRest = rig.restPos[bn("Body")]

local function rotF(p, a) return { p[1] * cos(a) + p[2] * sin(a), -p[1] * sin(a) + p[2] * cos(a) } end   -- foot pitch: + = toes down
local function reach(a, b) return cos(a) * L1 + cos(a - b) * L2 end
local POSE_KEYS = { "hipY", "lean", "nod", "thighA", "kneeA", "thighB", "kneeB", "pitchA", "pitchB", "uA", "fA", "uB", "fB" }
local function copy(p) local o = {}; for _, k in POSE_KEYS do o[k] = p[k] or 0 end; return o end
local function with(p, q) local o = copy(p); for k, v in q do o[k] = v end; return o end
local function withHip(p)
	local o = copy(p)
	o.hipY = max(reach(o.thighA, o.kneeA), reach(o.thighB, o.kneeB)) + ANKLE_H
	return o
end
local function lerpPose(a, b, k) local o = {}; for _, key in POSE_KEYS do o[key] = lerp(a[key], b[key], k) end; return o end
local function legPts(hx, hy, a, b, f)
	local kx, ky = hx + sin(a) * L1 * f, hy - cos(a) * L1
	return { kx, ky }, { kx + sin(a - b) * L2 * f, ky - cos(a - b) * L2 }
end

-- rotate a bone (from its rest pose) so its child lies toward target (world)
local function rotBetween(a, b)
	local d = clamp(a:Dot(b), -1, 1)
	if d > 0.9999999 then return CFrame.identity end
	local axis = a:Cross(b)
	if axis.Magnitude < 1e-7 then
		axis = a:Cross(Vector3.xAxis)
		if axis.Magnitude < 1e-6 then axis = a:Cross(Vector3.yAxis) end
	end
	return CFrame.fromAxisAngle(axis.Unit, math.acos(d))
end
local function aimBone(b, c, target)
	local from = rig.world[b].Position
	local p = rig.parent[b]
	local parentW = p > 0 and rig.world[p] or rig.rootCF
	local d = parentW:VectorToObjectSpace((target - from).Unit)
	local r0 = rig.restRot[b]:VectorToWorldSpace(rig.pos[c].Unit)
	rig.rot[b] = rotBetween(r0, d) * rig.restRot[b]
	updateNode(rig, b)
end
local function Lp(x, y, z) return rig.rootCF * V3(x, y, z) end   -- figure-local metres → stage

-- ---------- lever geometry (needed by the poses) ----------
local function leverShadowPoint(frac, a)   -- a: the lever's angle (its rotation about z), fully on by default
	a = a or SW.maxTilt
	local x, y = Geo.shadowOf(V3(SW.x - sin(a) * SW.lever * frac, PLINTH.h + SW.pivot + cos(a) * SW.lever * frac, SW.z))
	return { x = x, y = y }
end
local CONTACT = leverShadowPoint(0.5)
local LEVER_HALF_W = 0.0019 * Geo.ratio(SW.z)

-- ---------- poses ----------
local CHAIR_X = -0.78
local SEAT_Y = ChairData.SEAT_Y
local SIT_HIP = ChairData.SIT_HIP
local SIT_X = lerp(ChairData.back, ChairData.front, 0.42)
local FRONT_X = SIT_X + L1
local STRIKE_B, KICK_PITCH = 0.06, 0.1
local SUPPORT = { thighB = 0, kneeB = 0.08, pitchB = 0 }
local KICK_HIP, STRIKE = 0.26, { a = 0.9, x = -0.2 }
local POSES = {}
local PUSH = { dx = 0.03, kickAnkle = { 0, 0 }, supAnkle = { 0, 0 }, follow = { 0, 0 } }
local KICK = { dur = 0.78, contact = 0.5, release = 0.64 }

local function ik(hx, hy, ax, ay)   -- thigh angle and knee bend; knee points forward
	local dx, dy = ax - hx, ay - hy
	local d = clamp(sqrt(dx * dx + dy * dy), abs(L1 - L2) + 1e-5, L1 + L2 - 1e-5)
	local beta = math.acos(clamp((L1 * L1 + d * d - L2 * L2) / (2 * L1 * d), -1, 1))
	local knee = math.acos(clamp((L1 * L1 + L2 * L2 - d * d) / (2 * L1 * L2), -1, 1))
	return { a = math.atan2(dx, -dy) + beta, b = pi - knee }
end
local function toeAt(a)
	local _, an = legPts(0, KICK_HIP, a, STRIKE_B, 1)
	local t = rotF(FOOTS.R.tip, KICK_PITCH)   -- she kicks with her right (leg A)
	return { an[1] + t[1], an[2] + t[2] }
end
local function pushLegs(dx)
	local hx, hy = STRIKE.x + dx, KICK_HIP - abs(dx) * 0.2   -- sinks a little as she leans in
	local k = ik(hx, hy, PUSH.kickAnkle[1] + PUSH.follow[1], PUSH.kickAnkle[2] + PUSH.follow[2])
	local sp = ik(hx, hy, PUSH.supAnkle[1], ANKLE_H)
	return { x = hx, hipY = hy, thighA = k.a, kneeA = k.b, thighB = sp.a, kneeB = sp.b }
end

-- walking: planted feet + two-bone IK, timing from clinical gait data (exhibit.js)
local GAIT = { c = 0.25, heelEnd = 0.08, heelOff = 0.45, toeOff = 0.6, strike = -0.22, push = 0.6 }
local GAITS = {
	walk = { S = 0.30, v = 0.30, clear = 0.014, Hc = 0.256, bob = 0.006, lean = 0.07, nod = 0, arm = 0.7, elbow = 0.16 },
	trudge = { S = 0.20, v = 0.15, clear = 0.009, Hc = 0.25, bob = 0.004, lean = 0.2, nod = 0.4, arm = 0.3, elbow = 0.22 },
	run = { S = 0.40, v = 0.62, clear = 0.022, Hc = 0.25, bob = 0.009, lean = 0.2, nod = -0.05, arm = 1.2, elbow = 1.1 },
}
do   -- initFigureConstants
	local legMax = L1 + L2
	GAITS.walk.Hc = legMax * 0.965 + ANKLE_H; GAITS.trudge.Hc = legMax * 0.94 + ANKLE_H; GAITS.run.Hc = legMax * 0.93 + ANKLE_H
	local legK = legMax / 0.265
	GAITS.walk.S = 0.30 * legK; GAITS.walk.v = 0.27 * legK; GAITS.walk.clear = 0.014 * legK
	GAITS.trudge.S = 0.2 * legK; GAITS.trudge.v = 0.11 * legK; GAITS.trudge.clear = 0.009 * legK
	GAITS.run.S = 0.4 * legK; GAITS.run.v = 0.62 * legK; GAITS.run.clear = 0.022 * legK
	local th0 = 0.02 * L2 / (L1 + L2)
	local stand = withHip { thighA = th0, kneeA = 0.02, thighB = th0, kneeB = 0.02, lean = 0.03, uA = 0.06, fA = 0.14, uB = -0.04, fB = 0.12, nod = 0 }
	local legs = ik(SIT_X, SIT_HIP, FRONT_X, ANKLE_H)
	local seatLegs = { hipY = SIT_HIP, thighA = legs.a, kneeA = legs.b, thighB = legs.a, kneeB = legs.b, pitchA = 0, pitchB = 0 }
	local function seated(extra) local o = with(stand, seatLegs); for k, v in extra do o[k] = v end; return o end
	POSES = {
		stand = stand,
		sitRest = seated { lean = 0.06, nod = 0.08, uA = 0.42, fA = 0.85, uB = 0.36, fB = 0.9 },
		headInHands = seated { lean = 0.62, nod = 0.95, uA = 0.0, fA = 2.3, uB = -0.04, fB = 2.27 },
		chinInHands = seated { lean = 0.5, nod = -0.3, uA = 0.65, fA = 2.45, uB = 0.61, fB = 2.42 },
	}
	SUPPORT.thighB = SUPPORT.kneeB * L2 / (L1 + L2)   -- support ankle exactly under the hip
	KICK_HIP = reach(SUPPORT.thighB, SUPPORT.kneeB) + ANKLE_H
	local lo, hi = 0.1, 1.7
	for _ = 1, 50 do local m = (lo + hi) / 2; if toeAt(m)[2] < CONTACT.y then lo = m else hi = m end end
	local a = (lo + hi) / 2
	STRIKE = { a = a, x = CONTACT.x - LEVER_HALF_W + 0.004 - toeAt(a)[1] }
	local _, ka = legPts(STRIKE.x, KICK_HIP, STRIKE.a, STRIKE_B, 1)
	local _, sa = legPts(STRIKE.x, KICK_HIP, SUPPORT.thighB, SUPPORT.kneeB, 1)
	PUSH.kickAnkle, PUSH.supAnkle = ka, sa
	PUSH.dx = 0
	while PUSH.dx < 0.12 and pushLegs(PUSH.dx).kneeA < 0.44 do PUSH.dx += 0.001 end
end

local function footAt(phi, Af, G)
	local F = G.F or FOOTS.L
	if phi < GAIT.heelEnd then   -- heel strike → foot flat, pivoting on the heel
		local p = lerp(GAIT.strike, 0, ss(phi / GAIT.heelEnd))
		local hx = Af + F.heel[1]
		local r = rotF(F.heel, p)
		return { x = hx - r[1], y = -r[2], p = p }
	end
	if phi < GAIT.heelOff then return { x = Af, y = ANKLE_H, p = 0 } end
	if phi < GAIT.toeOff then   -- heel-off → toe-off, pivoting on the toe
		local p = lerp(0, GAIT.push, ss((phi - GAIT.heelOff) / (GAIT.toeOff - GAIT.heelOff)))
		local tx = Af + F.toe[1]
		local r = rotF(F.toe, p)
		return { x = tx - r[1], y = -r[2], p = p }
	end
	local u = (phi - GAIT.toeOff) / (1 - GAIT.toeOff)   -- swing
	local a, b = footAt(GAIT.toeOff - 1e-9, Af, G), footAt(0, Af + G.S, G)
	return { x = lerp(a.x, b.x, ss(u)), y = lerp(a.y, b.y, u) + G.clear * sin(pi * u), p = lerp(GAIT.push, GAIT.strike, ss(u / 0.75)) }
end
local OFFSETS = { A = 0.25, B = 0.75 }
local function gaitPose(d, w)
	local G, S, win = w.G, w.S, 0.25 * w.S
	local k = min(ss(d / win), ss((w.D - d) / win))
	local feet = {}
	for _, L in { "A", "B" } do
		local s = d / S + OFFSETS[L]
		local phi = s - math.floor(s)
		local Af = (math.floor(s) - OFFSETS[L]) * S + GAIT.c * S
		local GF = { S = S, clear = G.clear, F = L == "A" and FOOTS.R or FOOTS.L }
		local ft = footAt(phi, Af, GF)
		if L == "B" and d < win then   -- first step: B swings out from where it stood
			local uu = clamp((phi - 0.75) / 0.25, 0, 1)
			local b = footAt(0, Af + S, GF)
			ft = { x = lerp(0, b.x, ss(uu)), y = lerp(ANKLE_H, b.y, uu) + G.clear * sin(pi * uu), p = lerp(0, GAIT.strike, ss(uu)) }
		end
		if L == w.lastSwing and d > w.D - win and phi >= GAIT.toeOff - 1e-9 then   -- last step: swing in beside the planted foot
			local uu = clamp((phi - GAIT.toeOff) / (0.75 - GAIT.toeOff), 0, 1)
			local a = footAt(GAIT.toeOff - 1e-9, Af, GF)
			ft = { x = lerp(a.x, w.D, ss(uu)), y = lerp(a.y, ANKLE_H, uu) + G.clear * sin(pi * uu), p = lerp(GAIT.push, 0, ss(uu)) }
		end
		ft.phi = phi
		feet[L] = ft
	end
	local gaitHip = G.Hc + G.bob * cos(4 * pi * (feet.A.phi - GAIT.c))
	local hy = lerp(POSES.stand.hipY, gaitHip, k)
	for _, L in { "A", "B" } do
		local dx, mx = feet[L].x - d, L1 + L2 - 0.0015
		hy = min(hy, feet[L].y + sqrt(max(0, mx * mx - dx * dx)))
	end
	local A, B = ik(d, hy, feet.A.x, feet.A.y), ik(d, hy, feet.B.x, feet.B.y)
	local upper = { lean = G.lean, nod = G.nod, uA = -G.arm * A.a + 0.04, fA = G.elbow + 0.3 * max(0, -G.arm * A.a), uB = -G.arm * B.a + 0.04, fB = G.elbow + 0.3 * max(0, -G.arm * B.a) }
	local rest = d < w.D / 2 and w.from or POSES.stand
	local o = { hipY = hy, thighA = A.a, kneeA = A.b, pitchA = feet.A.p, thighB = B.a, kneeB = B.b, pitchB = feet.B.p }
	for key, v in upper do o[key] = lerp(rest[key], v, k) end
	return o
end
-- critically damped smoothing
local function smoothDamp(cur, target, st, smoothTime, dt)
	local omega = 2 / smoothTime
	local x = omega * dt
	local e = 1 / (1 + x + 0.48 * x * x + 0.235 * x * x * x)
	local change = cur - target
	local temp = (st.v + omega * change) * dt
	st.v = (st.v - omega * temp) * e
	local out = target + (change + temp) * e
	if (target - cur > 0) == (out > target) then out = target; st.v = 0 end
	return out
end

local fig = { x = SIT_X, face = 1, pose = copy(POSES.sitRest), trans = nil }
local function transitionTo(to, dt, dur)
	if not fig.trans or fig.trans.to ~= to then
		local d = 0
		for _, k in { "hipY", "thighA", "kneeA", "thighB", "kneeB", "lean" } do d = max(d, abs(fig.pose[k] - to[k]) / (k == "hipY" and 0.12 or 1.2)) end
		fig.trans = { from = copy(fig.pose), to = to, t = 0, dur = dur or clamp(0.25 + d * 0.8, 0.25, 1.0) }
	end
	local tr = fig.trans
	tr.t += dt
	local k = tr.t / tr.dur
	local e = k <= 0 and 0 or k >= 1 and 1 or k * k * k * (k * (k * 6 - 15) + 10)
	fig.pose = lerpPose(tr.from, tr.to, e)
	if k >= 1 then fig.trans = nil; fig.pose = copy(to); return true end
	return false
end
local function nearStand(p)
	local m = 0
	for _, key in { "thighA", "kneeA", "thighB", "kneeB", "pitchA", "pitchB" } do m = max(m, abs(p[key] - POSES.stand[key])) end
	return m < 0.02 and abs(p.hipY - POSES.stand.hipY) < 0.002
end

-- turning on the spot: feet stay planted; a half-turn takes three steps (exhibit.js turnInPlace)
local yaw = pi / 2
local turn = nil
local turnLegs = nil
local function yawOf(face) return face > 0 and pi / 2 or -pi / 2 end
local function standAnkle(side, yw)
	local lat, st = LAT[side].hip, POSES.stand
	local f = sin(st.thighA) * L1 + sin(st.thighA - st.kneeA) * L2
	return V3(fig.x + lat * cos(yw) + f * sin(yw), ANKLE_H, -lat * sin(yw) + f * cos(yw))
end
local TURN = { lift = 0.012, dip = 0.008 }
local function turnInPlace(face, dt)
	local target = yawOf(face)
	if not turn then
		if abs(yaw - target) < 0.01 then yaw = target; fig.face = face; return true end
		local y0 = yaw
		local d = target - y0
		local F = d > 0 and "R" or "L"
		local O = F == "R" and "L" or "R"
		local steps = abs(d) > 0.9
			and { { swing = F, yaw = y0 + d / 2, foot = y0 + d / 2, dur = 0.4 }, { swing = O, yaw = target, foot = target, dur = 0.4 }, { swing = F, yaw = target, foot = target, dur = 0.3 } }
			or { { swing = F, yaw = target, foot = target, dur = 0.35 }, { swing = O, yaw = target, foot = target, dur = 0.3 } }
		turn = { target = target, steps = steps, k = 1, t = 0, yawFrom = y0,
			feet = { R = { p = standAnkle("R", y0), yaw = y0 }, L = { p = standAnkle("L", y0), yaw = y0 } } }
	end
	local T = turn
	local st = T.steps[T.k]
	T.t += dt
	local u = clamp(T.t / st.dur, 0, 1)
	local e = u * u * u * (u * (u * 6 - 15) + 10)
	yaw = lerp(T.yawFrom, st.yaw, e)
	local legs = {}
	for _, side in { "R", "L" } do
		local f = T.feet[side]
		if side == st.swing then
			local dest = standAnkle(side, st.foot)
			local p = f.p:Lerp(dest, e)
			legs[side] = { pos = V3(p.X, ANKLE_H + TURN.lift * sin(pi * u), p.Z), yaw = lerp(f.yaw, st.foot, e) }
			if u >= 1 then f.p = dest; f.yaw = st.foot end
		else
			legs[side] = { pos = f.p, yaw = f.yaw }
		end
	end
	turnLegs = legs
	fig.pose = with(POSES.stand, { hipY = POSES.stand.hipY - TURN.dip * sin(pi * u) })
	if u >= 1 then
		T.k += 1; T.t = 0; T.yawFrom = st.yaw
		if T.k > #T.steps then
			turn = nil; turnLegs = nil; yaw = T.target; fig.face = T.target > 0 and 1 or -1; fig.pose = copy(POSES.stand)
			return T.target == target
		end
	end
	return false
end

local walker = nil
local function walkTo(tx, dt, gaitName)
	if not walker or walker.tx ~= tx then
		if abs(tx - fig.x) < 0.002 then fig.x = tx; walker = nil; return true end
		if not turn and not nearStand(fig.pose) then transitionTo(POSES.stand, dt); return false end
		if not turnInPlace(sign(tx - fig.x), dt) then return false end
		local G = GAITS[gaitName or "walk"]
		local D = abs(tx - fig.x)
		local m = max(1, math.round(2 * D / G.S))
		local S = 2 * D / m
		local lastSwing = abs(((D / S + OFFSETS.A) % 1) - 0.75) < 0.01 and "A" or "B"
		local cur = fig.pose
		fig.pose = with(POSES.stand, { lean = cur.lean, nod = cur.nod, uA = cur.uA, fA = cur.fA, uB = cur.uB, fB = cur.fB })
		walker = { x0 = fig.x, tx = tx, dir = sign(tx - fig.x), D = D, S = S, d = 0, from = copy(fig.pose), G = G, lastSwing = lastSwing, tt = 0 }
	end
	local w, G = walker, walker.G
	w.tt += dt
	local ramp = min(0.04 + ss(w.tt / 0.35), 1, 0.1 + 0.9 * ss((w.D - w.d) / 0.07))
	w.d = min(w.D, w.d + (w.vOverride or G.v) * ramp * dt)
	fig.pose = gaitPose(w.d, w)
	fig.face = w.dir
	fig.x = w.x0 + w.dir * w.d
	if w.d >= w.D then walker = nil; fig.x = tx; return true end
	return false
end
local function stopWalk()   -- end the walk at the next foot-together point
	local w = walker
	if not w or w.stopping then return end
	local half = 0.5 * w.S
	local D = min(w.D, math.ceil((w.d + 0.25 * w.S) / half - 1e-6) * half)
	if D < w.D - 1e-6 then
		w.D = D; w.tx = w.x0 + w.dir * D
		w.lastSwing = abs(((D / w.S + OFFSETS.A) % 1) - 0.75) < 0.01 and "A" or "B"
	end
	w.stopping = true
	w.vOverride = GAITS.walk.v * 1.15
end
local function goTo(tx, dt, gait)
	if walker and abs(walker.tx - tx) > 1e-6 then stopWalk() end
	if walker and walker.stopping then if walkTo(walker.tx, dt) then walker = nil end; return false end
	return walkTo(tx, dt, gait)
end
local function halt(dt)
	if turn then turnInPlace(turn.target > 0 and 1 or -1, dt); return false end
	if walker then stopWalk(); if walkTo(walker.tx, dt) then walker = nil end; return false end
	return true
end

-- the kick: arms counterbalance the leg
local function kickPose(u, held)
	local p = with(POSES.stand, { thighB = SUPPORT.thighB, kneeB = SUPPORT.kneeB, pitchB = SUPPORT.pitchB, hipY = KICK_HIP })
	if u < 0.4 then   -- wind up: the foot lifts straight up first, then draws back
		local k, lift, back = ss(u / 0.4), ss(min(1, u / 0.4 * 2.2)), ss(max(0, (u / 0.4 - 0.25) / 0.75))
		p.kneeA = lerp(POSES.stand.kneeA, 1.14, lift)
		p.thighA = lerp(p.kneeA * L2 / (L1 + L2), -0.55, back); p.pitchA = 0.5 * k; p.lean = 0.14 * k
		p.uA = lerp(0.06, 0.55, k); p.fA = lerp(0.14, 1.05, k); p.uB = lerp(-0.04, -0.45, k); p.fB = lerp(0.12, 0.85, k)
	elseif u < KICK.contact then   -- strike
		local k = min(1, (u - 0.4) / (KICK.contact - 0.4))
		p.thighA = -0.55 + (STRIKE.a + 0.55) * k; p.kneeA = 1.14 - (1.14 - STRIKE_B) * k
		p.pitchA = lerp(0.5, KICK_PITCH, k); p.lean = 0.14 - 0.28 * k
		p.uA = lerp(0.55, -0.4, k); p.fA = lerp(1.05, 0.3, k); p.uB = lerp(-0.45, 0.7, k); p.fB = lerp(0.85, 0.35, k)
	elseif u < KICK.release then   -- foot on the lever
		local k = (u - KICK.contact) / (KICK.release - KICK.contact)
		p.thighA = STRIKE.a; p.kneeA = STRIKE_B; p.pitchA = KICK_PITCH; p.lean = -0.14
		p.uA = -0.4; p.fA = 0.3 + 0.25 * sin(k * pi); p.uB = 0.7; p.fB = 0.35 + 0.3 * sin(k * pi)
	else   -- bounce back off a held switch, or swing through a free one, then recover
		local k = min(1, (u - KICK.release) / (1 - KICK.release))
		local over = held and -0.12 * sin(k * pi) or 0.15 * sin(k * pi)
		local fold = sin(min(1, k / 0.6) * pi / 2)
		local settle = ss(max(0, (k - 0.55) / 0.45))
		local knee = lerp(STRIKE_B, 0.75, fold) * (1 - settle) + POSES.stand.kneeA * settle
		local under, toUnder = knee * L2 / (L1 + L2), ss(min(1, k / 0.55))
		p.kneeA = knee; p.thighA = lerp(STRIKE.a + over, under, toUnder)
		p.pitchA = KICK_PITCH * (1 - k); p.lean = -0.14 * (1 - k)
		p.uA = lerp(-0.4, 0.06, ss(k)); p.fA = lerp(0.3, 0.14, ss(k)) + 0.55 * sin(k * pi)
		p.uB = lerp(0.7, -0.04, ss(k)); p.fB = lerp(0.35, 0.12, ss(k)) + 0.45 * sin(k * pi)
	end
	-- elbows drawn back and bent, fists tucked in, for the whole kick
	local e = ss(u / 0.22) * (1 - ss((u - 0.8) / 0.2))
	p.uA -= 0.55 * e; p.uB -= 0.55 * e; p.fA += 0.75 * e; p.fB += 0.75 * e
	return p
end
local pushForce, kickAge = 0, 9
local function kickJolt() return kickAge < 0.03 and kickAge / 0.03 or math.exp(-(kickAge - 0.03) / 0.07) end
local function strain() return max(pushForce, 0.8 * kickJolt()) end
local function pushPose(t)
	local pulse = 0.5 - 0.5 * cos(t * pi * 2 * 0.9)
	local p = kickPose(KICK.contact + 0.001, true)
	local legs = pushLegs(PUSH.dx + 0.008 * pulse)
	for k, v in legs do if k ~= "x" then p[k] = v end end
	p.pitchA = KICK_PITCH + 0.12 * pulse; p.lean = -0.04 - 0.06 * pulse
	p.uA = -0.25 - 0.2 * pulse; p.fA = 0.75 + 0.45 * pulse; p.uB = 0.55 + 0.15 * pulse; p.fB = 0.8 + 0.5 * pulse
	p.nod = 0.2 + 0.1 * pulse
	return p, pulse, legs.x
end

-- sitting down and standing up: feet stay planted in front of the seat
local function sitPose(u, endP)
	local e = u * u * u * (u * (u * 6 - 15) + 10)
	local hx = lerp(FRONT_X, SIT_X, ss(min(1, u * 1.25)))
	local hy = lerp(POSES.stand.hipY, SIT_HIP, ss(max(0, (u - 0.08) / 0.92)))
	local leg = ik(hx, hy, FRONT_X, ANKLE_H)
	local sb = sin(pi * u)
	local bend = 0.5 * sb * sb
	local o = lerpPose(POSES.stand, endP, e)
	o.hipY, o.thighA, o.kneeA, o.thighB, o.kneeB, o.pitchA, o.pitchB = hy, leg.a, leg.b, leg.a, leg.b, 0, 0
	o.lean = lerp(POSES.stand.lean, endP.lean, e) + bend
	o.uA += bend * 0.6; o.uB += bend * 0.5
	return hx, o
end

-- the angry stomp: fists down, head lowered, she stamps one foot then the other
local STOMP = { pre = 0.3, stamp = 0.42, post = 0.55 }
local function stompDur(n) return STOMP.pre + n * STOMP.stamp + STOMP.post end
local function stompPose(t, n, from)
	local st, total = POSES.stand, stompDur(n)
	local fx = sin(st.thighA) * L1 + sin(st.thighA - st.kneeA) * L2
	local anger = ss(t / STOMP.pre) * (1 - ss((t - (total - STOMP.post)) / STOMP.post))
	local H = 0.34 * L2
	local lift, imp, side = 0, 0, "A"
	for i = 0, n - 1 do
		local u = (t - STOMP.pre - i * STOMP.stamp) / STOMP.stamp
		if u >= 0 and u < 1 then
			side = i % 2 == 1 and "B" or "A"
			lift = u < 0.5 and H * sin(u / 0.5 * pi / 2) or u < 0.72 and H * (1 - ((u - 0.5) / 0.22) ^ 2) or 0
		end
		local s = t - STOMP.pre - (i + 0.72) * STOMP.stamp
		if s >= 0 then imp = max(imp, math.exp(-s / 0.07)) end
	end
	local hy = st.hipY - 0.025 * L1 * anger - 0.03 * L1 * imp
	local flat, up = ik(0, hy, fx, ANKLE_H), ik(0, hy, fx + 0.25 * lift, ANKLE_H + lift)
	local lifted, other = side == "A" and up or flat, side == "A" and flat or up
	local toe = 0.3 * lift / H
	local angry = { lean = 0.17 + 0.07 * imp, nod = 0.3 + 0.12 * imp, uA = -0.16 - 0.12 * imp, fA = 0.28 - 0.1 * imp, uB = -0.2 - 0.12 * imp, fB = 0.3 - 0.1 * imp }
	local o = { hipY = hy, thighA = lifted.a, kneeA = lifted.b, pitchA = side == "A" and toe or 0, thighB = other.a, kneeB = other.b, pitchB = side == "B" and toe or 0 }
	local base = t < STOMP.pre and from or st
	for key, v in angry do o[key] = lerp(base[key], v, anger) end
	return o
end

-- ---------- pose → bones (exhibit.js applyFigure) ----------
local SHADOW_FLOOR = Geo.SHADOW_FLOOR
local FLOOR_TILT = CFrame.fromAxisAngle(Vector3.xAxis, math.atan(SHADOW_FLOOR))
local SOLE_SINK = 0.0012
local function solveLeg(side, A, fwd)
	fwd = fwd or V3(sin(yaw), 0, cos(yaw))
	A = V3(A.X, A.Y - SHADOW_FLOOR * A.Z - SOLE_SINK, A.Z)
	local H = rig.world[bn("UpperLeg." .. side)].Position
	local v = A - H
	local d = clamp(v.Magnitude, abs(L1 - L2) + 1e-4, L1 + L2 - 1e-4)
	local dir = v.Unit
	local a = (L1 * L1 - L2 * L2 + d * d) / (2 * d)
	local h = sqrt(max(0, L1 * L1 - a * a))
	local pole = (fwd - dir * fwd:Dot(dir)).Unit
	local knee, ank = H + dir * a + pole * h, H + dir * d
	aimBone(bn("UpperLeg." .. side), bn("LowerLeg." .. side), knee)
	aimBone(bn("LowerLeg." .. side), bn("LowerLeg." .. side .. "_end"), ank)
end
local function placeFoot(side, footRot)
	local foot = bn("Foot." .. side)
	local at = rig.world[bn("LowerLeg." .. side .. "_end")].Position
	local pw = rig.world[rig.parent[foot]]
	rig.pos[foot] = pw:PointToObjectSpace(at)
	rig.rot[foot] = pw.Rotation:Inverse() * footRot
	updateNode(rig, foot)
end

local Spring = {}
Spring.__index = Spring
function Spring.new() return setmetatable({ x = 0, v = 0 }, Spring) end
function Spring:step(target, k, c, dt) self.v += (k * (target - self.x) - c * self.v) * dt; self.x += self.v * dt; return self.x end

-- secondary motion: the hips' smoothed velocity and acceleration drive a spring per spine segment
local WOB = {
	k = { 190, 150, 115, 90, 70 }, zeta = 0.34,
	fwd = { -0.01, -0.02, -0.03, -0.04, -0.05 }, vert = { 0.005, 0.01, 0.015, 0.02, 0.026 },
	lean = { -0.001, -0.0025, -0.004, -0.0055, -0.0075 }, kick = { 0.003, 0.004, 0.0045, 0.005, 0.005 },
	side = { 0.0, 0.25, 0.5, 0.75, 1 }, arm = { k = 80, zeta = 0.3, fwd = -0.05 },
}
local wob = nil
local upper = nil
local UPPER = { "lean", "nod", "uA", "fA", "uB", "fB" }
local function wobble(dt, p)
	if not wob then
		wob = { last = nil, sv = { 0, 0 }, lsv = { 0, 0 }, lv = 0, tv = 0, f = {}, arm = { Spring.new(), Spring.new() }, t = 0, out = { f = { 0, 0, 0, 0, 0 }, s = { 0, 0, 0, 0, 0 }, arm = { 0, 0 } } }
		for i = 1, 5 do wob.f[i] = Spring.new() end
	end
	local w = wob
	if not (dt > 0) then return w.out end
	w.t += dt
	local pos, lean, thigh = { fig.x, p.hipY }, upper.lean, p.thighA
	if not w.last or abs(pos[1] - w.last[1]) > 0.05 or abs(pos[2] - w.last[2]) > 0.05 then
		w.last = pos; w.sv = { 0, 0 }; w.lsv = { 0, 0 }; w.lv = lean.v; w.lastThigh = thigh; w.tv = 0
		return w.out
	end
	local k = 1 - math.exp(-dt / 0.05)
	for i = 1, 2 do w.sv[i] += ((pos[i] - w.last[i]) / dt - w.sv[i]) * k end
	local af = clamp((w.sv[1] - w.lsv[1]) / dt * sin(yaw), -6, 6)
	local av = clamp((w.sv[2] - w.lsv[2]) / dt, -6, 6)
	local la = clamp((lean.v - w.lv) / dt, -60, 60)
	local tv = (thigh - w.lastThigh) / dt
	w.tv += (tv - w.tv) * k
	local ta = clamp(w.tv, -12, 12)
	w.last = pos; w.lsv = { w.sv[1], w.sv[2] }; w.lv = lean.v; w.lastThigh = thigh
	local n = 4
	local h = dt / n
	for i = 1, 5 do
		local target = WOB.fwd[i] * af + WOB.vert[i] * av + WOB.lean[i] * la - WOB.kick[i] * ta
		local c = 2 * WOB.zeta * sqrt(WOB.k[i])
		for _ = 1, n do w.f[i]:step(target, WOB.k[i], c, h) end
		w.out.f[i] = w.f[i].x
		w.out.s[i] = 0.006 * WOB.side[i] * (sin(w.t * 0.9 + (i - 1) * 0.4) + 0.5 * sin(w.t * 1.7 + 1.3))
	end
	local ca = 2 * WOB.arm.zeta * sqrt(WOB.arm.k)
	for s = 1, 2 do for _ = 1, n do w.arm[s]:step(WOB.arm.fwd * af, WOB.arm.k, ca, h) end end
	w.out.arm[1], w.out.arm[2] = w.arm[1].x, w.arm[2].x
	return w.out
end

local function applyFigure(dt)
	if not upper then upper = {}; for _, k in UPPER do upper[k] = { x = fig.pose[k], v = 0 } end end
	local p = copy(fig.pose)
	for _, k in UPPER do
		local u = upper[k]
		u.x = dt > 0 and smoothDamp(u.x, fig.pose[k], u, 0.08, dt) or fig.pose[k]
		p[k] = u.x
	end
	rig.rootCF = CFrame.new(fig.x, 0, 0) * CFrame.Angles(0, yaw, 0)
	resetRig(rig)
	updateRig(rig)
	-- lift the pelvis so the hip joints sit at the pose's hip height, centred over the origin
	local body = bn("Body")
	local hipNow = (rig.world[bn("UpperLeg.L")].Position + rig.world[bn("UpperLeg.R")].Position) * 0.5
	local hipWant = Lp(0, p.hipY, 0)
	local bp = rig.world[rig.parent[body]]
	rig.pos[body] = bodyRest + bp:PointToObjectSpace(hipWant) - bp:PointToObjectSpace(hipNow)
	updateNode(rig, body)
	-- spine and head lean forward about the hips, each segment wobbling a little on its own spring
	local wb = wobble(dt, p)
	local origin = Lp(0, 0, 0)
	local function up(ang, side) return Lp(sin(side or 0), cos(ang), sin(ang)) - origin end
	local function aimDir(b, c, d) local bi = bn(b); aimBone(bi, bn(c), rig.world[bi].Position + d) end
	aimDir("Hips", "Abdomen", up(p.lean * 0.6 + wb.f[1], wb.s[1]))
	aimDir("Abdomen", "Torso", up(p.lean + wb.f[2], wb.s[2]))
	aimDir("Torso", "Chest", up(p.lean + wb.f[3], wb.s[3]))
	aimDir("Chest", "Neck", up(p.lean + wb.f[4], wb.s[4]))
	aimDir("Neck", "Head", up(p.lean + p.nod * 0.5 + wb.f[5], wb.s[5]))
	aimDir("Head", "Head_end", up(p.lean + p.nod + wb.f[5] * 1.15, wb.s[5]))
	p.uA += wb.arm[1]; p.uB += wb.arm[2]
	-- legs: solved in 3D from her real hip joints to the ankles the pose asks for, feet placed with their pitch
	if turnLegs then
		local fwd = V3(sin(yaw), 0, cos(yaw))
		for _, side in { "R", "L" } do
			local g = turnLegs[side]
			solveLeg(side, g.pos, fwd)
			placeFoot(side, FLOOR_TILT * CFrame.fromAxisAngle(Vector3.yAxis, g.yaw) * footRest[side])
		end
	else
		for _, L in { { "R", p.thighA, p.kneeA, p.pitchA }, { "L", p.thighB, p.kneeB, p.pitchB } } do
			local side, th, kn, pt = L[1], L[2], L[3], L[4]
			local lat = LAT[side].hip
			local ank = Lp(lat, p.hipY - cos(th) * L1 - cos(th - kn) * L2, sin(th) * L1 + sin(th - kn) * L2)
			solveLeg(side, ank)
			placeFoot(side, FLOOR_TILT * rig.rootCF.Rotation * CFrame.fromAxisAngle(Vector3.xAxis, pt) * footRest[side])
		end
	end
	-- arms swing in the walking plane, opening slightly outward
	for _, A in { { "R", p.uA, p.fA }, { "L", p.uB, p.fB } } do
		local side, u, fa = A[1], A[2], A[3]
		local out = sign(LAT[side].sh) * 0.12
		local ua = u + p.lean * 0.4
		local sh = rig.world[bn("UpperArm." .. side)].Position
		local d1 = (Lp(out, -cos(ua), sin(ua)) - origin).Unit
		aimBone(bn("UpperArm." .. side), bn("LowerArm." .. side), sh + d1 * UA)
		local el = rig.world[bn("LowerArm." .. side)].Position
		local d2 = (Lp(out * 0.5, -cos(ua + fa), sin(ua + fa)) - origin).Unit
		aimBone(bn("LowerArm." .. side), bn(HAND .. "." .. side), el + d2 * FA)
	end
end

local function drawFigure()
	for i = 1, figSkin.nv do
		local x, y = stageShadow(skinVertex(rig, figSkin, i))
		figEm:SetPosition(figIds[i], V3(x * SCALE, y * SCALE, 0))
	end
end

-- ---------- behaviour (exhibit.js stepFigure) ----------
local S = { mode = "rest", t = 0, fails = 0, hit = false, patience = 3, clock = 0, flips = {}, stomps = 0, minSit = 1.5 }
local ANGER = { flips = 3, within = 8 }
local seatedPose = nil
local on, tilt, tiltVel, lampLevel = true, -SW.maxTilt, 0, 1
local dragging = nil   -- the visitor's hand is on the lever
local turnDt = 0
local function turnTo(face) return turnInPlace(face, turnDt) end
local function newAttempt() S.fails = 0; S.patience = math.random(2, 5) end
local function startSit(endName, nextMode, dur) S.sit = { u = 0, dir = 1, dur = dur or 1.25, endP = POSES[endName] }; S.mode = "sitting"; S.next = nextMode; seatedPose = endName end
local function startRise(nextMode, dur) S.sit = { u = 1, dir = -1, dur = dur or 1.0, endP = fig.pose }; S.mode = "sitting"; S.next = nextMode end
local function stepSit(dt)
	local st = S.sit
	st.u = clamp(st.u + st.dir * dt / st.dur, 0, 1)
	local x, pose = sitPose(st.u, st.endP)
	fig.x, fig.face, fig.pose = x, 1, pose
	if st.dir > 0 then return st.u >= 1 end
	return st.u <= 0
end
local function followLever()
	local c = leverShadowPoint(0.5, -tilt)
	PUSH.follow = { c.x - CONTACT.x, c.y - CONTACT.y }
end

local setOn
local function afterKick()
	if not on then S.mode = "home"; S.t = 0; return end
	if S.fails >= S.patience then S.mode = "giveupWalk"; return end
	if S.fails >= 1 and math.random() < 0.4 then S.mode = "push"; S.t = -0.2; S.dur = rand(1.5, 2.6); S.hit = false; return end
	S.mode = "kick"; S.t = -rand(0.2, 0.5); S.hit = false
end

local function stepFigure(dt, t)
	S.t += dt; S.clock += dt; turnDt = dt
	pushForce = 0; PUSH.follow = { 0, 0 }
	local m = S.mode
	if m == "rest" then   -- sitting quietly; when the lamp comes on she takes a moment before getting up
		if on then
			S.wait = S.wait or rand(1.0, 2.6)
			S.wait -= dt
			if S.wait <= 0 and S.t > S.minSit then S.wait = nil; newAttempt(); startRise("notice") end
		else S.wait = nil end
	elseif m == "sitting" then
		if stepSit(dt) then
			if S.sit.dir > 0 then
				S.mode, S.t, S.wait = S.next, 0, nil
				S.minSit = S.next == "sulk" and rand(6, 11) or rand(4, 8)
				S.fakeIn = rand(12, 22)
			else fig.pose = copy(POSES.stand); S.mode = S.next; S.t = 0 end
		end
	elseif m == "notice" then   -- a beat to look at the switch
		local k = 1 - 0.01 ^ dt
		local to = with(POSES.stand, { nod = -0.15 + min(S.t, 0.5) * 0.3 })
		for _, key in POSE_KEYS do fig.pose[key] += (to[key] - fig.pose[key]) * k end
		if S.t > 0.7 then S.mode = "approach" end
	elseif m == "approach" then
		if goTo(STRIKE.x, dt, "walk") then S.mode = "kick"; S.t = 0; S.hit = false end
	elseif m == "kick" then
		if not turnTo(1) then S.t = min(S.t, 0); return end   -- the kick starts once she faces the switch
		local u = S.t / KICK.dur
		local kp = kickPose(max(0, u), dragging ~= nil and on)
		if u < 0.3 then
			local k = 1 - 1e-6 ^ dt
			for _, key in POSE_KEYS do fig.pose[key] += (kp[key] - fig.pose[key]) * k end
		else fig.pose = kp end
		if not S.hit and u >= KICK.contact then
			S.hit = true
			if on and not dragging then setOn(false, "kick") else S.fails += 1; if dragging then kickAge = 0 end end
		end
		if u >= 1 and S.mode == "kick" then afterKick() end
	elseif m == "push" then   -- kick in, then linger and lean on the lever
		followLever()
		if S.t < 0 then
			local k = 1 - 1e-4 ^ dt
			for _, key in POSE_KEYS do fig.pose[key] += (POSES.stand[key] - fig.pose[key]) * k end
			return
		end
		local inT = KICK.contact * KICK.dur
		if S.t < inT then fig.pose = kickPose(S.t / KICK.dur, true); return end
		local lt = S.t - inT
		if lt < S.dur then
			local p, pulse, x = pushPose(lt)
			local k = ss(lt / 0.35)
			fig.pose = lerpPose(kickPose(KICK.contact + 0.001, true), p, k)
			fig.x = lerp(STRIKE.x, x, k)
			if k < 1 then
				local legs = pushLegs((x - STRIKE.x) * k)
				for key, v in legs do if key ~= "x" then fig.pose[key] = v end end
			end
			pushForce = pulse * k
			if on and not dragging then setOn(false, "kick"); S.dur = lt end   -- let go mid-push: it goes
			return
		end
		local ru = KICK.release + (lt - S.dur) / (KICK.dur * (1 - KICK.release)) * (1 - KICK.release)
		fig.pose = kickPose(min(1, ru), true)
		local back = 1 - ss(min(1, (ru - KICK.release) / 0.15))
		fig.x = STRIKE.x + PUSH.dx * back
		fig.pose.hipY = KICK_HIP - PUSH.dx * 0.2 * back
		local sp = ik(fig.x, fig.pose.hipY, PUSH.supAnkle[1], ANKLE_H)
		fig.pose.thighB, fig.pose.kneeB = sp.a, sp.b
		local fade = 1 - ss(min(1, (ru - KICK.release) / 0.2))
		if fade > 0 and (PUSH.follow[1] ~= 0 or PUSH.follow[2] ~= 0) then
			local _, an = legPts(fig.x, fig.pose.hipY, fig.pose.thighA, fig.pose.kneeA, 1)
			local k = ik(fig.x, fig.pose.hipY, an[1] + PUSH.follow[1] * fade, an[2] + PUSH.follow[2] * fade)
			fig.pose.thighA, fig.pose.kneeA = k.a, k.b
		end
		if ru >= 1 then S.fails += 1; afterKick() end
	elseif m == "giveupWalk" then   -- trudge back to the chair, turn round at its front, sit down despairing
		if not goTo(FRONT_X, dt, "trudge") then return end
		if not turnTo(1) then return end
		startSit(math.random() < 0.5 and "headInHands" or "chinInHands", "sulk", 1.5)
	elseif m == "sulk" then
		fig.pose.nod = POSES[seatedPose].nod + sin(t * 0.8) * 0.04 * ss(S.t / 1.5)
		if on and not dragging then   -- let go: she notices after a moment, once she has sulked a while
			S.wait = S.wait or rand(0.8, 2.2)
			S.wait -= dt
			if S.wait <= 0 and S.t > S.minSit then S.wait = nil; newAttempt(); startRise("notice", 1.0) end
			return
		end
		S.wait = nil
		if on and dragging then
			S.fakeIn -= dt
			if S.fakeIn <= 0 then
				if math.random() < 0.35 then startRise("fakeRun", 0.45) else S.fakeIn = rand(12, 22) end   -- jump up and dash at it
			end
		end
	elseif m == "fakeRun" then
		if goTo(STRIKE.x - 0.08, dt, "run") then S.mode = "stare"; S.t = 0; S.dur = rand(0.8, 1.6) end
	elseif m == "stare" then   -- stop short and eye it up
		if not turnTo(1) then return end
		local k = 1 - 0.02 ^ dt
		local to = with(POSES.stand, { lean = 0.12, nod = 0.25 + 0.05 * sin(S.t * 3) })
		for _, key in POSE_KEYS do fig.pose[key] += (to[key] - fig.pose[key]) * k end
		if S.t > S.dur then
			if on and not dragging then S.mode = "approach"
			elseif math.random() < 0.5 then S.mode = "giveupWalk"
			else newAttempt(); S.mode = "approach" end
		end
	elseif m == "stomp" then   -- fed up: stop, stamp, then carry on with whatever the light now says
		if not S.from then
			if not halt(dt) then S.t = 0; return end
			S.from = copy(fig.pose); S.t = 0
		end
		local n = S.stomps > 1 and 4 or 3
		fig.pose = stompPose(min(S.t, stompDur(n)), n, S.from)
		if S.t >= stompDur(n) then fig.pose = copy(POSES.stand); S.from = nil; S.flips = {}; S.mode = on and "approach" or "home"; S.t = 0 end
	elseif m == "home" then   -- lamp off: walk back slowly in the dark and sit down
		if not goTo(FRONT_X, dt, "trudge") then return end
		if not turnTo(1) then return end
		startSit("sitRest", "rest", 1.4)
	end
end

setOn = function(v, source)
	if v == on then return end
	on = v
	if source == "kick" then tiltVel += 9
	elseif source ~= "drag" then tiltVel += on and -5 or 5 end
	-- turning her round mid-walk (to the switch / back to the chair) counts towards losing her temper
	local reverses = on and S.mode == "home" or (not on and (S.mode == "notice" or S.mode == "approach"))
	if not on then
		if table.find({ "notice", "approach", "fakeRun", "stare", "giveupWalk" }, S.mode) then S.mode = "home"; S.t = 0 end
	else
		if S.mode == "home" or S.mode == "giveupWalk" then newAttempt(); S.mode = "approach" end
	end
	if reverses then
		local kept = {}
		for _, c in S.flips do if S.clock - c < ANGER.within then table.insert(kept, c) end end
		table.insert(kept, S.clock)
		S.flips = kept
		-- she loses her temper on a flip that brings the light back: a tantrum in the dark would go unseen
		if on and #S.flips >= ANGER.flips then S.stomps += 1; S.mode = "stomp"; S.t = 0; S.from = nil end
	end
end

-- ---------- the switch and its shadow ----------
-- leverPivot.rotation.z = -(tilt + strain): positive leans the lever left (on)
local pivotCF = CFrame.new(SW.x * SCALE, (PLINTH.h + SW.pivot) * SCALE + 0.003, SW.z * SCALE)
local LV = {}
local function newShadowPart(name, shape)
	local p = Instance.new("Part")
	p.Name = name
	if shape then p.Shape = shape end
	p.Anchored, p.CanCollide, p.CanQuery, p.CanTouch, p.CastShadow = true, false, false, false, false
	p.Material, p.Color = SHADOW_MATERIAL, SHADOW
	p.Parent = wallFolder
	table.insert(shadowParts, p)
	return p
end
LV.rod, LV.tip, LV.bush, LV.cap = newShadowPart("LeverShadow"), newShadowPart("LeverTipShadow", Enum.PartType.Cylinder), newShadowPart("BushingShadow"), newShadowPart("CapShadow", Enum.PartType.Cylinder)
local LV_Z = WALL_STUDS + OFF + 0.006
local function wallSeg(p, ax, ay, bx, by, w)   -- absolute wall metres
	local dx, dy = bx - ax, by - ay
	p.Size = V3(max(sqrt(dx * dx + dy * dy), 1e-3) * SCALE, w * SCALE, 0.01)
	p.CFrame = CFrame.new((ax + bx) / 2 * SCALE, (ay + by) / 2 * SCALE, LV_Z) * CFrame.Angles(0, 0, math.atan2(dy, dx))
end
local function wallDisc(p, x, y, d)
	p.Size = V3(0.01, d * SCALE, d * SCALE)
	p.CFrame = CFrame.new(x * SCALE, y * SCALE, LV_Z) * CFrame.Angles(0, pi / 2, 0)
end
local function leverWorld(frac, rz)   -- a point along the lever (metres, world)
	return V3(SW.x - sin(rz) * SW.lever * frac, PLINTH.h + SW.pivot + cos(rz) * SW.lever * frac, SW.z)
end
local function drawSwitch(rz)
	local rot = pivotCF * CFrame.Angles(0, 0, rz)
	leverPart.CFrame = rot
	-- its shadow, through the lamp; the switch body's shadow is a stub just above the ledge
	local k = Geo.ratio(SW.z)
	local bx, by = worldShadow(leverWorld(0, rz))
	local tx, ty = worldShadow(leverWorld(SW.tipC / SW.lever, rz))
	wallSeg(LV.rod, bx, by, tx, ty, 0.0042 * k)
	wallDisc(LV.tip, tx, ty, 0.0064 * k)
	local _, ytop = worldShadow(V3(SW.x, PLINTH.h + 0.0158, SW.z))
	local xs = worldShadow(V3(SW.x, PLINTH.h, SW.z))
	wallSeg(LV.bush, xs, LEDGE_Y - 0.01, xs, ytop, 0.0118 * k)
	wallDisc(LV.cap, xs, ytop, 0.0108 * k)
end

-- ---------- the visitor's hand: WebXR generic hand (right.glb), MIT, (c) 2019 Amazon ----------
-- (its own function scope: Luau allows 200 locals per function)
local hand, updateHand, leverTipWorld = (function()
local hrig = newRig(HandData)
local hskin = newSkin(hrig, HandData)
local function hb(n) return hrig.idx[n] end
local hand = { flex = -1, q = CFrame.identity, alpha = 0, want = 0, pos = V3(), vel = V3(), target = V3(), sv = V3(), lastSv = V3(), acc = V3(),
	sp = { yaw = Spring.new(), roll = Spring.new(), pitch = Spring.new(), mid = Spring.new(), ring = Spring.new(), pinky = Spring.new(), thumb = Spring.new(), press = Spring.new() } }
local DEG = pi / 180
local function bend(name, angle)
	local b = hb(name)
	if not b then return end
	hrig.rot[b] = hrig.restRot[b] * CFrame.fromAxisAngle(Vector3.xAxis, hand.flex * angle)
end
local function poseHand(t)
	local s, press = hand.sp, hand.sp.press.x
	local breathe = sin(t * 1.9) * 2 * DEG
	bend("index-finger-phalanx-proximal", (22 + 8 * (1 - press)) * DEG)
	bend("index-finger-phalanx-distal", (8 - 22 * press - 16 * strain()) * DEG)
	bend("index-finger-phalanx-intermediate", (20 - 6 * press + 9 * strain()) * DEG)
	local function curl(f, a, b, c, j)
		bend(f .. "-finger-phalanx-proximal", a * DEG + j + breathe)
		bend(f .. "-finger-phalanx-intermediate", b * DEG + j * 0.8 + breathe)
		bend(f .. "-finger-phalanx-distal", c * DEG + j * 0.5)
	end
	curl("middle", 78, 95, 55, s.mid.x)
	curl("ring", 82, 95, 55, s.ring.x)
	curl("pinky", 86, 92, 50, s.pinky.x)
	bend("thumb-phalanx-proximal", 18 * DEG + s.thumb.x)
	bend("thumb-phalanx-distal", 20 * DEG + s.thumb.x * 0.6)
end
do   -- which way a positive local-X turn bends a finger, and the hand's orientation (exhibit.js setupHand)
	hrig.rootCF = CFrame.identity
	updateRig(hrig)
	local function wp(n) return hrig.world[hb(n)].Position end
	local fM = (wp("index-finger-tip") - wp("index-finger-phalanx-proximal")).Unit
	local sM = (wp("index-finger-metacarpal") - wp("pinky-finger-metacarpal")).Unit
	local palm = sM:Cross(fM).Unit
	local tip0 = wp("index-finger-tip")
	local b = hb("index-finger-phalanx-proximal")
	hrig.rot[b] = hrig.restRot[b] * CFrame.fromAxisAngle(Vector3.xAxis, 0.4)
	updateRig(hrig)
	hand.flex = (wp("index-finger-tip") - tip0):Dot(palm) > 0 and 1 or -1
	resetRig(hrig)
	poseHand(0)
	updateRig(hrig)
	-- the arm comes in from the right as in the reel; index points left and down, palm down, thumb toward the viewer
	local f = (wp("index-finger-tip") - wp("index-finger-phalanx-proximal")).Unit
	local s = wp("index-finger-metacarpal") - wp("pinky-finger-metacarpal")
	s = (s - f * s:Dot(f)).Unit
	local fW = V3(-0.86, -0.45, -0.24).Unit
	local sW = V3(0.05, 0.1, 1)
	sW = (sW - fW * sW:Dot(fW)).Unit
	local bm = CFrame.fromMatrix(Vector3.zero, f, s, f:Cross(s))
	local bw = CFrame.fromMatrix(Vector3.zero, fW, sW, fW:Cross(sW))
	hand.q = bw * bm:Inverse()
end

-- the skin and its shadow fade out toward the open edge at the wrist, dithered (4x4 Bayer) against the fade
local BAYER = { 0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5 }
local SKIN = Color3.new(0.96, 0.78, 0.68)
local handUV = unb64(HandData.uv)
-- The hand and its shadow are each split in two: the core, and the band toward the wrist that carries the
-- dithered fade, cut into small pieces that are kept or dropped (skinFringe).
local FADE_U = (-0.05 - HandData.U0) / (HandData.U1 - HandData.U0) - 0.01
local function handMesh(name, flat, fringe, material, into)
	local em = into
	if not em then
		em = AssetService:CreateEditableMesh()
		local Bd = 60
		for _, s in { -1, 1 } do
			local a = em:AddVertex(V3(s * Bd, s * Bd, s * Bd))
			em:AddTriangle(a, em:AddVertex(V3(s * Bd, s * Bd, s * Bd)), em:AddVertex(V3(s * Bd, s * Bd, s * Bd)))
		end
	end
	local ids, uvs, cols, us = {}, {}, {}, table.create(hskin.nv)
	for i = 1, hskin.nv do us[i] = clamp(buffer.readf32(handUV, (i - 1) * 8), 0, 1) end
	local function want(t) return (max(us[hskin.tris[t]], us[hskin.tris[t + 1]], us[hskin.tris[t + 2]]) > FADE_U) == fringe end
	-- only the vertices this half uses (runtime meshes share a small memory budget)
	for t = 1, #hskin.tris, 3 do
		if want(t) then
			for k = 0, 2 do
				local i = hskin.tris[t + k]
				if not ids[i] then
					ids[i] = em:AddVertex(V3(0, 0, 0))
					uvs[i] = em:AddUV(Vector2.new(us[i], clamp(buffer.readf32(handUV, (i - 1) * 8 + 4), 0, 1)))
					if not flat then cols[i] = em:AddColor(Color3.new(1, 1, 1), 1) end
				end
			end
		end
	end
	local n = flat and em:AddNormal(V3(0, 0, 1))
	for t = 1, #hskin.tris, 3 do
		local a, b, c = hskin.tris[t], hskin.tris[t + 1], hskin.tris[t + 2]
		if want(t) then
			local f1 = em:AddTriangle(ids[a], ids[b], ids[c])
			em:SetFaceUVs(f1, { uvs[a], uvs[b], uvs[c] })
			if not flat then em:SetFaceColors(f1, { cols[a], cols[b], cols[c] }) end
			if flat then
				local f2 = em:AddTriangle(ids[a], ids[c], ids[b])
				em:SetFaceUVs(f2, { uvs[a], uvs[c], uvs[b] })
				em:SetFaceNormals(f1, { n, n, n }); em:SetFaceNormals(f2, { n, n, n })
			end
		end
	end
	if into then return { em = em, ids = ids, fringe = fringe, shadow = flat } end   -- drawn by the shared wall mesh
	local mp = AssetService:CreateMeshPartAsync(Content.fromObject(em))
	mp.Name = name
	mp.Anchored, mp.CanCollide, mp.CanQuery, mp.CanTouch, mp.CastShadow = true, false, false, false, false
	mp.Material = material
	return { em = em, ids = ids, cols = cols, part = mp, fringe = fringe, shadow = flat }
end
-- The skin's dithered band is geometry, not a texture: each of its triangles is cut into small pieces and each
-- piece is kept or dropped against a 4x4 Bayer threshold on the fade. Opaque and unlit, so it looks the same at
-- every graphics level (a transparent texture is drawn differently from one level to the next).
local function skinFringe(name, shadow)
	local em = AssetService:CreateEditableMesh()
	local Bd = 60
	for _, sg in { -1, 1 } do
		local a = em:AddVertex(V3(sg * Bd, sg * Bd, sg * Bd))
		em:AddTriangle(a, em:AddVertex(V3(sg * Bd, sg * Bd, sg * Bd)), em:AddVertex(V3(sg * Bd, sg * Bd, sg * Bd)))
	end
	local U0, U1, N, CELL = HandData.U0, HandData.U1, 3, 0.0012
	local OUTER = shadow and 0.015 or 0   -- the shadow fades a little further out than the skin (exhibit.js)
	local nrm = shadow and em:AddNormal(V3(0, 0, 1))
	local function uvAt(i) return buffer.readf32(handUV, (i - 1) * 8), buffer.readf32(handUV, (i - 1) * 8 + 4) end
	local micro = {}
	local tris = hskin.tris
	for t = 1, #tris, 3 do
		local a, b, c = tris[t], tris[t + 1], tris[t + 2]
		local ua, va = uvAt(a)
		local ub, vb = uvAt(b)
		local uc, vc = uvAt(c)
		if max(clamp(ua, 0, 1), clamp(ub, 0, 1), clamp(uc, 0, 1)) <= FADE_U then continue end
		-- grid point (i, j): weights a = 1 - (i + j) / N, b = i / N, c = j / N
		local grid = {}
		local function G(i, j)
			local key = i * 16 + j
			if not grid[key] then
				local wb, wc = i / N, j / N
				local m = { a = a, b = b, c = c, wa = 1 - wb - wc, wb = wb, wc = wc }
				m.id = em:AddVertex(V3(0, 0, 0))
				if not shadow then m.cid = em:AddColor(Color3.new(1, 1, 1), 1) end
				table.insert(micro, m)
				grid[key] = m
			end
			return grid[key]
		end
		-- a piece (three grid points) is kept if the fade at its centre beats the Bayer threshold there; only the
		-- grid points kept pieces use become vertices
		local function piece(i1, j1, i2, j2, i3, j3)
			local wb, wc = (i1 + i2 + i3) / (3 * N), (j1 + j2 + j3) / (3 * N)
			local wa = 1 - wb - wc
			local u, v = ua * wa + ub * wb + uc * wc, va * wa + vb * wb + vc * wc
			local along = U0 + u * (U1 - U0)
			local fade = 1 - ss((along + 0.05) / (0.05 + OUTER))
			local x, y = math.floor(u * (U1 - U0) / CELL), math.floor(v * 0.16 / CELL)
			if fade > (BAYER[(y % 4) * 4 + (x % 4) + 1] + 0.5) / 16 then
				local p1, p2, p3 = G(i1, j1), G(i2, j2), G(i3, j3)
				if shadow then   -- flat on the wall: both windings, facing the room
					for _, f in { em:AddTriangle(p1.id, p2.id, p3.id), em:AddTriangle(p1.id, p3.id, p2.id) } do em:SetFaceNormals(f, { nrm, nrm, nrm }) end
				else
					local f = em:AddTriangle(p1.id, p2.id, p3.id)
					em:SetFaceColors(f, { p1.cid, p2.cid, p3.cid })
				end
			end
		end
		for i = 0, N - 1 do
			for j = 0, N - 1 - i do
				piece(i, j, i + 1, j, i, j + 1)
				if i + j + 2 <= N then piece(i + 1, j, i + 1, j + 1, i, j + 1) end
			end
		end
	end
	local mp = AssetService:CreateMeshPartAsync(Content.fromObject(em))
	mp.Name = name
	mp.Anchored, mp.CanCollide, mp.CanQuery, mp.CanTouch, mp.CastShadow = true, false, false, false, false
	mp.Material = Enum.Material.Neon
	return { em = em, ids = {}, cols = {}, micro = micro, part = mp, fringe = true, shadow = shadow == true }
end
local handLayers = {
	handMesh("Hand", false, false, Enum.Material.Neon),
	skinFringe("HandFringe"),
	handMesh("HandShadow", true, false, SHADOW_MATERIAL, wallEm),
	skinFringe("HandShadowFringe", true),
}
for _, L in handLayers do
	if not L.part then continue end
	if L.shadow then
		L.part.CFrame = CFrame.new(0, 0, WALL_STUDS + OFF + 0.01)
		L.part.Parent = wallFolder
	else
		L.part.CFrame = CFrame.identity
		L.part.Parent = workspace
	end
	L.part.Color = L.shadow and SHADOW or Color3.new(1, 1, 1)
end

local function leverTipWorld() return leverWorld(SW.tipC / SW.lever, -tilt) end
local HP, HN, HK = table.create(hskin.nv), table.create(hskin.nv), table.create(hskin.nv)
local DOWN_POS = V3(0.6, 3.1, 1.95)
local function wrap(x) return max(0, (x + 0.25) / 1.25) end   -- light wrapping round, as on skin
local function updateHand(dt, t)
	local H = hand
	H.alpha += ((H.want > 0 and 1 or 0) - H.alpha) * (1 - (H.want > 0 and 0.002 or 0.0005) ^ dt)
	if H.alpha < 0.01 and H.want > 0 then H.pos = H.target; H.vel = V3() end
	local n = 4
	local h = dt / n
	for _ = 1, n do   -- the fingertip glides to its target on a critically damped spring
		H.vel += ((H.target - H.pos) * 260 - H.vel * (2 * sqrt(260))) * h
		H.pos += H.vel * h
	end
	if dragging then H.pos = H.target end   -- on the lever, the finger is exactly on its tip
	H.sv = H.sv:Lerp(H.vel, 1 - math.exp(-dt / 0.06))
	local acc = (H.sv - H.lastSv) / max(dt, 1e-3)
	if acc.Magnitude > 8 then acc = acc.Unit * 8 end
	H.acc, H.lastSv = acc, H.sv
	local function drift(seed, a) return a * (sin(t * 0.73 + seed) + 0.6 * sin(t * 1.37 + seed * 2.1) + 0.35 * sin(t * 2.91 + seed * 3.7)) end
	local s, vx, vy, vz = H.sp, H.sv.X, H.sv.Y, H.sv.Z
	for _ = 1, n do
		s.yaw:step(clamp(-vx * 1.2, -0.35, 0.35) + drift(1, 0.02), 44, 5, h)
		s.roll:step(clamp(vx * 1.6 - H.acc.X * 0.02, -0.4, 0.4) + drift(2, 0.025), 42, 5, h)
		s.pitch:step(clamp(vz * 1.4 + vy * 1.2 + H.acc.Z * 0.015, -0.35, 0.35) + drift(3, 0.02), 50, 5, h)
		local j = clamp(H.acc.Magnitude * 0.012 + vy * 0.8, -0.25, 0.25)
		s.mid:step(j, 85, 3.5, h); s.ring:step(j, 110, 3.5, h); s.pinky:step(j, 140, 3.5, h); s.thumb:step(j * 0.6, 70, 3.5, h)
		s.press:step(dragging and 1 or 0, 260, 20, h)
	end
	resetRig(hrig)
	poseHand(t)
	-- rotation sways around the fingertip; re-centred so the tip stays exactly on the target
	local pivotRot = CFrame.fromEulerAnglesYXZ(s.pitch.x, s.yaw.x, s.roll.x)
	hrig.rootCF = hand.q
	updateRig(hrig)
	local tipLocal = hrig.world[hb("index-finger-tip")].Position
	hrig.rootCF = CFrame.new(H.pos) * pivotRot * CFrame.new(-tipLocal) * hand.q
	updateRig(hrig)
	local visible = H.alpha > 0.01
	for _, L in handLayers do
		local tr = H.alpha > 0.99 and 0 or 1 - H.alpha
		if L.part then L.part.Transparency = visible and tr or 1 end
	end
	-- the shadow's core lives in the shared wall mesh: folded away to a point while the hand is gone
	local coreShown = H.alpha > 0.5
	if not coreShown and H.coreShown ~= false then
		local L = handLayers[3]
		for _, id in L.ids do L.em:SetPosition(id, Vector3.zero) end
	end
	H.coreShown = coreShown
	if not visible then return end
	local core, fringe, score, sfringe = handLayers[1], handLayers[2], handLayers[3], handLayers[4]
	-- The skin is lit here, not by Roblox (whose lighting changes with the graphics level): Lambert from the
	-- downlight above and the lamp behind the viewer, wrapped a little as skin is, from the skinned normals.
	local pw, nw = HP, HN
	for i = 1, hskin.nv do pw[i] = skinVertex(hrig, hskin, i) end
	-- (the light on the skin changes slowly: it is worked out every other frame, the shape every frame)
	H.shadeTick = not H.shadeTick
	local reshade = H.shadeTick or not H.shaded
	H.shaded = true
	local tris = hskin.tris
	if reshade then for i = 1, hskin.nv do nw[i] = Vector3.zero end end
	for t = 1, reshade and #tris or 0, 3 do
		local a, b, c = tris[t], tris[t + 1], tris[t + 2]
		local fn = (pw[b] - pw[a]):Cross(pw[c] - pw[a])
		nw[a] += fn; nw[b] += fn; nw[c] += fn
	end
	local kk = HK
	for i = 1, reshade and hskin.nv or 0 do
		local n = nw[i].Magnitude > 0 and nw[i].Unit or Vector3.yAxis
		local p = pw[i]
		local dd, dl = (DOWN_POS - p).Unit, (LAMP - p).Unit
		local e = 0.5 + 0.85 * wrap(n:Dot(dd)) + 0.6 * lampLevel * wrap(n:Dot(dl))
		kk[i] = (1 - math.exp(-1.7 * e)) / 1.6   -- (Neon shows colours brighter than they are set)
		if core.cols[i] then local k = kk[i]; core.em:SetColor(core.cols[i], Color3.new(SKIN.R * k, SKIN.G * k, SKIN.B * k)) end
	end
	for _, m in fringe.micro do
		fringe.em:SetPosition(m.id, (pw[m.a] * m.wa + pw[m.b] * m.wb + pw[m.c] * m.wc) * SCALE)
		if reshade then
			local k = kk[m.a] * m.wa + kk[m.b] * m.wb + kk[m.c] * m.wc
			fringe.em:SetColor(m.cid, Color3.new(SKIN.R * k, SKIN.G * k, SKIN.B * k))
		end
	end
	for i = 1, hskin.nv do
		local p = pw[i]
		local x, y = worldShadow(p)
		local w = V3(x * SCALE, y * SCALE, 0)
		if core.ids[i] then core.em:SetPosition(core.ids[i], p * SCALE); if coreShown then score.em:SetPosition(score.ids[i], w) end end
	end
	for _, m in sfringe.micro do
		local x, y = worldShadow(pw[m.a] * m.wa + pw[m.b] * m.wb + pw[m.c] * m.wc)
		sfringe.em:SetPosition(m.id, V3(x * SCALE, y * SCALE, 0))
	end
end
return hand, updateHand, leverTipWorld
end)()
makeWall()   -- the wall mesh's part, once her, her chair and the hand's shadow are all in it

-- ---------- camera views: the close-up (exhibit.js VIEWS.close) and the visitor's own camera ----------
-- (with the input and the credit line, in its own function scope: Luau allows 200 locals per function)
local toggleView, getView, aimHand, grab, release = (function()
local DEG = pi / 180
local cam = workspace.CurrentCamera
local view = "room"
local inkLabels = {}   -- the credit line: dark over the white plinth in the close-up, light in the room
local layoutLines = function() end   -- (set once the lines exist, below)
local fly = nil
local CLOSE = { pos = V3(SW.x, 1.2, 1.22), target = V3(SW.x, 1.0, -4) }
local function closeFov()
	-- keep at least the horizontal view of a 1.25:1 window; tall screens get a taller view instead of a cropped one
	local vp = cam.ViewportSize
	local aspect = vp.X / max(vp.Y, 1)
	local hBase = 2 * math.atan(math.tan(23 * DEG) * 1.25)
	return clamp(2 * math.atan(math.tan(hBase / 2) / aspect) / DEG, 46, 62), aspect < 0.8
end
local function closeCF()
	local _, portrait = closeFov()
	local target = portrait and V3(CLOSE.target.X, 1.16, CLOSE.target.Z) or CLOSE.target
	return CFrame.lookAt(CLOSE.pos * SCALE, target * SCALE)
end
local function setCharacterHidden(hidden)
	local ch = player.Character
	if not ch then return end
	for _, d in ch:GetDescendants() do
		if d:IsA("BasePart") or d:IsA("Decal") then d.LocalTransparencyModifier = hidden and 1 or 0 end
	end
end
local function toggleView()
	if view == "room" then
		view = "close"
		fly = { from = cam.CFrame, fromFov = cam.FieldOfView, t = 0 }
		cam.CameraType = Enum.CameraType.Scriptable
		for _, l in inkLabels do l.TextColor3 = Color3.fromRGB(20, 20, 22) end
		-- (on a phone the thumbstick and jump button would sit on the plinth; there is nowhere to walk here)
		game:GetService("GuiService").TouchControlsEnabled = false
		task.defer(function() layoutLines() end)
	else
		game:GetService("GuiService").TouchControlsEnabled = true
		task.defer(function() layoutLines() end)
		view = "room"
		for _, l in inkLabels do l.TextColor3 = Color3.fromRGB(235, 235, 235) end
		fly = nil
		cam.CameraType = Enum.CameraType.Custom
		cam.FieldOfView = 70
		setCharacterHidden(false)
	end
end
RunService:BindToRenderStep("DiligentShadowCamera", Enum.RenderPriority.Camera.Value + 1, function(dt)
	if view ~= "close" then return end
	cam.CameraType = Enum.CameraType.Scriptable
	local fov = closeFov()
	local want = closeCF()
	if fly then
		fly.t = min(1, fly.t + dt / 1.1)
		local e = ss(fly.t)
		cam.CFrame = fly.from:Lerp(want, e)
		cam.FieldOfView = lerp(fly.fromFov, fov, e)
		if fly.t >= 1 then fly = nil end
	else
		cam.CFrame = want
		cam.FieldOfView = fov
	end
	setCharacterHidden(true)
	-- the credit line sits over the plinth's front, which the lamp lights: dark ink on it lit, light ink on it dark
	-- (each with a soft outline in the other tone, so it reads wherever a screen's shape puts it)
	local dark = lampLevel > 0.45
	local ink, edge = dark and Color3.fromRGB(20, 20, 22) or Color3.fromRGB(235, 235, 235), dark and Color3.fromRGB(235, 235, 235) or Color3.fromRGB(20, 20, 22)
	for _, l in inkLabels do l.TextColor3 = ink; l.TextStrokeColor3 = edge end
end)

-- ---------- input: the lever, the hand, the views ----------
local function nearSwitch()
	local ch = player.Character
	local root = ch and ch:FindFirstChild("HumanoidRootPart")
	return root and (root.Position - pivotPart.Position).Magnitude < 12
end
local function grab()
	if dragging then return end
	if not on then setOn(true, "hand") end
	dragging = { key = true }
end
local function release() dragging = nil end

local rayParams = RaycastParams.new()
rayParams.FilterType = Enum.RaycastFilterType.Include
rayParams.FilterDescendantsInstances = { grabPart, plinthPart }
-- where a pointer is, in viewport pixels: the mouse, or one particular finger (a touch's Position leaves out the
-- top-bar inset that viewport coordinates include)
local GuiService = game:GetService("GuiService")
local function pointerPos(input)
	if input and input.UserInputType == Enum.UserInputType.Touch then
		local inset = GuiService:GetGuiInset()
		return Vector2.new(input.Position.X, input.Position.Y) + inset
	end
	return UIS:GetMouseLocation()
end
local function pointerHit(input)
	local m = pointerPos(input)
	local r = cam:ViewportPointToRay(m.X, m.Y)
	return workspace:Raycast(r.Origin, r.Direction * 200, rayParams), r
end
local function isPointer(input) return input.UserInputType == Enum.UserInputType.MouseButton1 or input.UserInputType == Enum.UserInputType.Touch end
local press = nil
UIS.InputBegan:Connect(function(input, processed)
	if processed then return end   -- (the touch thumbstick and jump button keep their own touches)
	if input.KeyCode == Enum.KeyCode.C or input.KeyCode == Enum.KeyCode.Return then toggleView(); return end
	if input.KeyCode == Enum.KeyCode.E and (view == "close" or nearSwitch()) then grab() end
	if input.KeyCode == Enum.KeyCode.F and (view == "close" or nearSwitch()) and on then release(); setOn(false, "hand") end
	if isPointer(input) then
		local pos = pointerPos(input)
		press = { input = input, x = pos.X, y = pos.Y, t = os.clock() }
		local hit = pointerHit(input)
		if view == "close" and hit and hit.Instance == grabPart and not dragging then
			-- drag the lever: horizontal travel tilts it, and while a finger or the button is down the hand holds it
			-- (exhibit.js pointer handling)
			local a = cam:WorldToViewportPoint((pivotCF * CFrame.new(-sin(0.3) * SW.lever * SCALE, cos(0.3) * SW.lever * SCALE, 0)).Position)
			local b = cam:WorldToViewportPoint((pivotCF * CFrame.new(sin(0.3) * SW.lever * SCALE, cos(0.3) * SW.lever * SCALE, 0)).Position)
			dragging = { input = input, x = pos.X, tilt = tilt, k = max(40, abs(b.X - a.X) / 0.6) }
		end
	end
end)
UIS.InputChanged:Connect(function(input)
	if input.UserInputType ~= Enum.UserInputType.MouseMovement and input.UserInputType ~= Enum.UserInputType.Touch then return end
	if not (dragging and dragging.x) then return end
	-- the mouse moves as MouseMovement; a finger as its own Touch input (other fingers are not this drag)
	if input.UserInputType == Enum.UserInputType.Touch and input ~= dragging.input then return end
	local x = pointerPos(dragging.input.UserInputType == Enum.UserInputType.Touch and dragging.input or nil).X
	tilt = clamp(dragging.tilt + (x - dragging.x) / dragging.k, -SW.maxTilt, SW.maxTilt)
	tiltVel = 0
	if tilt < -0.05 and not on then setOn(true, "drag") end
	if tilt > 0.05 and on then setOn(false, "drag") end
end)
UIS.InputEnded:Connect(function(input)
	if input.KeyCode == Enum.KeyCode.E then release() end
	if not isPointer(input) then return end
	if dragging and dragging.x then
		if dragging.input == input or input.UserInputType == Enum.UserInputType.MouseButton1 then dragging = nil end
		return
	end
	local p = press
	if not p or p.input ~= input and input.UserInputType == Enum.UserInputType.Touch then return end
	press = nil
	-- a tap or click (no drag) on the plinth zooms between the close-up and the room
	local pos = pointerPos(input)
	if (pos - Vector2.new(p.x, p.y)).Magnitude < 10 and os.clock() - p.t < 0.5 then
		local hit = pointerHit(input)
		if hit and hit.Instance == plinthPart then toggleView() end
	end
end)

-- the hand: on the lever while it is held; in the close-up it also hovers over the switch under the pointer
local REACH = { front = SW.z + 0.22, back = SW.z - 0.14, x = 0.42, top = PLINTH.h + 0.9 }
local function aimHand()
	if dragging then
		hand.target = leverTipWorld() + V3(0, 0.0035, 0)
		hand.want = 1
		return
	end
	hand.want = 0
	if view ~= "close" or UIS:GetLastInputType() == Enum.UserInputType.Touch then return end   -- (no hover on a touch screen)
	local hit, ray = pointerHit()
	if hit and hit.Instance == grabPart then
		hand.target = leverTipWorld() + V3(0, 0.009, 0)
		hand.want = 1
		return
	end
	-- over the plinth top, the hand roams a little in front of and behind the switch
	local o, d = ray.Origin / SCALE, ray.Direction
	local hy = PLINTH.h + 0.055
	if d.Y < -1e-4 then
		local t = (hy - o.Y) / d.Y
		local p = o + d * t
		if p.Z < REACH.back then
			local t2 = (REACH.back - o.Z) / d.Z
			p = o + d * t2
			if p.Y < PLINTH.h + 0.045 then return end
		end
		if abs(p.X - SW.x) < REACH.x and p.Y < REACH.top and p.Z < PLINTH.z + 0.75 then
			hand.target = V3(p.X, p.Y, min(p.Z, REACH.front))
			hand.want = 1
		end
	end
end

-- ---------- credit line and hints ----------
local gui = Instance.new("ScreenGui")
gui.Name = "DiligentShadowHUD"
gui.ResetOnSpawn, gui.IgnoreGuiInset = false, true
-- the two lines stack from the bottom up, and grow upward when a narrow screen wraps them
local stack = Instance.new("Frame")
stack.Name = "Lines"
stack.BackgroundTransparency = 1
stack.AnchorPoint = Vector2.new(0.5, 1)
stack.Size = UDim2.new(1, -32, 0, 0)
stack.AutomaticSize = Enum.AutomaticSize.Y
stack.Parent = gui
local list = Instance.new("UIListLayout")
list.SortOrder = Enum.SortOrder.LayoutOrder
list.Padding = UDim.new(0, 4)
list.Parent = stack
local function label(text, order, size, alpha)
	local l = Instance.new("TextLabel")
	l.BackgroundTransparency = 1
	l.Size = UDim2.new(1, 0, 0, 0)
	l.AutomaticSize = Enum.AutomaticSize.Y
	l.LayoutOrder = order
	l.Font = Enum.Font.Garamond
	l.TextSize, l.TextColor3, l.TextTransparency, l.TextWrapped = size, Color3.fromRGB(235, 235, 235), alpha, true
	l.TextStrokeColor3, l.TextStrokeTransparency = Color3.fromRGB(20, 20, 22), 0.65
	l.Text = text
	l.Parent = stack
	table.insert(inkLabels, l)
	return l
end
local credit = label("The Diligent Shadow  ·  Koya Endo  ·  Tokyo Prototype 2026", 2, 19, 0.1)
local KEYS_HINT = "C  close-up    ·    E  hold the switch    ·    F  flip it off    ·    in the close-up, drag the switch"
local TOUCH_HINT = "Tap the plinth to look closer    ·    drag the switch on, and hold it"
local hint = label(KEYS_HINT, 1, 15, 0.4)
-- smaller type on a narrow (portrait) screen, and lifted clear of the thumbstick and jump button while they show
layoutLines = function()
	local vp = cam.ViewportSize
	local portrait = vp.Y > vp.X
	credit.TextSize, hint.TextSize = portrait and 16 or 19, portrait and 14 or 15
	local touchControls = UIS.TouchEnabled and view == "room" and UIS:GetLastInputType() == Enum.UserInputType.Touch
	stack.Position = UDim2.new(0.5, 0, 1, -(18 + ((touchControls and portrait) and 150 or 0)))
end
-- the hint speaks to whatever was used last: keys and mouse, or a touch screen
local function setHint()
	hint.Text = UIS:GetLastInputType() == Enum.UserInputType.Touch and TOUCH_HINT or KEYS_HINT
	layoutLines()
end
UIS.LastInputTypeChanged:Connect(setHint)
cam:GetPropertyChangedSignal("ViewportSize"):Connect(layoutLines)
setHint()
gui.Parent = player:WaitForChild("PlayerGui")
return toggleView, function() return view end, aimHand, grab, release
end)()

-- ---------- loop ----------
local clockT = 0
local frozen = false
local function frame(dt)
	clockT += dt
	kickAge += dt
	if not (dragging and dragging.x) then
		local rest = on and -SW.maxTilt or SW.maxTilt
		tiltVel += (rest - tilt) * 320 * dt - tiltVel * 20 * dt
		tilt += tiltVel * dt
	end
	if dragging and not dragging.x then tilt, tiltVel = -SW.maxTilt, 0 end   -- held on by the key
	lampLevel += ((on and 1 or 0) - lampLevel) * (1 - (on and 0.0005 or 1e-8) ^ dt)
	beam.Brightness = BEAM_I * lampLevel
	setLamp(lampLevel)
	downLight.Brightness = DOWN_I * (0.75 + 0.25 * lampLevel)
	stepFigure(dt, clockT)
	applyFigure(dt)
	local rz = -(tilt + (dragging and 0.035 * strain() or 0))
	drawSwitch(rz)
	shadeSwitch(workspace.CurrentCamera.CFrame.Position, lampLevel)
	aimHand()
	updateHand(dt, clockT)
	-- shadows exist only in the lamp's light
	-- Shadows are always drawn: they are the wall's own unlit colour, so they emerge as the pool brightens round
	-- them and vanish into the dark as it fades, exactly as real shadows do (in the dark there is nothing to see)
	if lampLevel > 0.002 then drawFigure() end
end
-- she starts seated on her chair
fig.x, fig.face, fig.pose, yaw = SIT_X, 1, copy(POSES.sitRest), pi / 2
applyFigure(0)
drawFigure()
RunService.RenderStepped:Connect(function(dt)
	if not frozen then frame(min(dt, 1 / 20)) end
end)

-- a hook for testing from the command bar: set workspace's DS_Cmd attribute to "freeze 1", "step 0.5",
-- "on 0", "hold 1", "view" or "mode stomp"; the state comes back in DS_Out
workspace:GetAttributeChangedSignal("DS_Cmd"):Connect(function()
	local cmd, arg = string.match(workspace:GetAttribute("DS_Cmd") or "", "^(%S+)%s*(%S*)")
	local n = tonumber(arg)
	if cmd == "freeze" then frozen = n == 1
	elseif cmd == "step" then for _ = 1, math.floor((n or 0) * 60) do frame(1 / 60) end
	elseif cmd == "on" then setOn(n == 1, "key")
	elseif cmd == "hold" then if n == 1 then grab() else release() end
	elseif cmd == "view" then toggleView()
	elseif cmd == "mode" then S.mode = arg; S.t = 0; S.from = nil
	end
	workspace:SetAttribute("DS_Out", string.format("%s t=%.2f on=%s held=%s x=%.3f fails=%d/%d view=%s", S.mode, S.t, tostring(on), tostring(dragging ~= nil), fig.x, S.fails, S.patience, getView()))
end)
