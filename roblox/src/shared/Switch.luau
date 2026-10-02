--!native
-- The panel toggle switch, turned on a lathe exactly as exhibit.js builds it: a washer with rounded edges, a
-- chamfered hex nut, a threaded bushing, the domed pivot cap, and the one-piece bat-handle lever.
--
-- Its steel is shaded here, not by Roblox's lights. In the web version the steel mirrors an environment map of
-- the room: dark walls, the lamp's bright pool ahead, the downlight overhead and the white plinth below. Each
-- frame every vertex looks up that environment along its reflection of the camera ray and the result is written
-- as a vertex colour on an unlit (Neon) surface, so the highlights slide over the steel as the view or the
-- lever moves, and look the same at every graphics level.
local AssetService = game:GetService("AssetService")
local Geo = require(script.Parent:WaitForChild("Geometry"))
local S, SW, PLINTH = Geo.S, Geo.SW, Geo.PLINTH
local sin, cos, pi, clamp, max = math.sin, math.cos, math.pi, math.clamp, math.max

-- uniform Catmull-Rom through profile points, as three.js SplineCurve.getPoints(n)
local function smooth(pts, n)
	local out = {}
	local m = #pts
	for i = 0, n do
		local t = i / n * (m - 1)
		local k = math.min(math.floor(t), m - 2)
		local u = t - k
		local p0, p1, p2, p3 = pts[math.max(k, 1)], pts[k + 1], pts[k + 2], pts[math.min(k + 3, m)]
		local function cr(a, b, c, d) return 0.5 * ((2 * b) + (-a + c) * u + (2 * a - 5 * b + 4 * c - d) * u * u + (-a + 3 * b - 3 * c + d) * u * u * u) end
		out[i + 1] = { math.max(0, cr(p0[1], p1[1], p2[1], p3[1])), cr(p0[2], p1[2], p2[2], p3[2]) }
	end
	return out
end

-- a mesh being built: its EditableMesh plus every vertex's local position, normal, colour id and finish
local function newMesh(bound)
	local em = AssetService:CreateEditableMesh()
	local Bd = bound or 0.5   -- two anchor triangles centre the MeshPart on the profiles' axis
	for _, s in { -1, 1 } do
		local a = em:AddVertex(Vector3.new(s * Bd, s * Bd, s * Bd))
		em:AddTriangle(a, em:AddVertex(Vector3.new(s * Bd, s * Bd, s * Bd)), em:AddVertex(Vector3.new(s * Bd, s * Bd, s * Bd)))
	end
	return { em = em, pos = {}, nrm = {}, col = {}, fin = {} }
end
local function vertex(M, p, n, finish)
	local v = M.em:AddVertex(p)
	local c = M.em:AddColor(Color3.new(1, 1, 1), 1)
	table.insert(M.pos, p); table.insert(M.nrm, n); table.insert(M.col, c); table.insert(M.fin, finish)
	return v, c
end
-- a triangle wound to face along its normal
local function tri(M, a, b, c, ca, cb, cc, pa, pb, pc, n)
	if (pb - pa):Cross(pc - pa):Dot(n) < 0 then b, c, cb, cc = c, b, cc, cb end
	local f = M.em:AddTriangle(a, b, c)
	M.em:SetFaceColors(f, { ca, cb, cc })
end

-- revolve a (radius, height) profile about the y axis; flat = one normal per face (the hex nut)
local function lathe(M, pts, segs, a0, finish, flat)
	local n = #pts
	local function P(j, a) return Vector3.new(pts[j][1] * sin(a), pts[j][2], pts[j][1] * cos(a)) * S end
	-- the profile's outward normal, (dy, -dr) along it
	local function n2(j0, j1)
		local dr, dy = pts[j1][1] - pts[j0][1], pts[j1][2] - pts[j0][2]
		local l = math.sqrt(dr * dr + dy * dy)
		if l == 0 then return 0, 1 end
		return dy / l, -dr / l
	end
	if flat then
		for i = 0, segs - 1 do
			local aa, ab = a0 + i / segs * 2 * pi, a0 + (i + 1) / segs * 2 * pi
			local am = (aa + ab) / 2
			for j = 1, n - 1 do
				local nr, ny = n2(j, j + 1)
				local nrm = Vector3.new(nr * sin(am), ny, nr * cos(am)).Unit
				local p1, p2, p3, p4 = P(j, aa), P(j + 1, aa), P(j + 1, ab), P(j, ab)
				local v1, c1 = vertex(M, p1, nrm, finish)
				local v2, c2 = vertex(M, p2, nrm, finish)
				local v3, c3 = vertex(M, p3, nrm, finish)
				local v4, c4 = vertex(M, p4, nrm, finish)
				if (p2 - p1):Cross(p3 - p1).Magnitude > 1e-12 then tri(M, v1, v2, v3, c1, c2, c3, p1, p2, p3, nrm) end
				if (p3 - p1):Cross(p4 - p1).Magnitude > 1e-12 then tri(M, v1, v3, v4, c1, c3, c4, p1, p3, p4, nrm) end
			end
		end
		return
	end
	local ids, cid, pos = {}, {}, {}
	for i = 0, segs - 1 do
		local a = a0 + i / segs * 2 * pi
		ids[i], cid[i], pos[i] = {}, {}, {}
		for j = 1, n do
			local nr, ny = n2(math.max(j - 1, 1), math.min(j + 1, n))
			local p = P(j, a)
			pos[i][j] = p
			ids[i][j], cid[i][j] = vertex(M, p, Vector3.new(nr * sin(a), ny, nr * cos(a)), finish)
		end
	end
	for i = 0, segs - 1 do
		local k = (i + 1) % segs
		local am = a0 + (i + 0.5) / segs * 2 * pi
		for j = 1, n - 1 do
			local a, b, c, d = ids[i][j], ids[i][j + 1], ids[k][j + 1], ids[k][j]
			local ca, cb, cc, cd = cid[i][j], cid[i][j + 1], cid[k][j + 1], cid[k][j]
			local pa, pb, pc, pd = pos[i][j], pos[i][j + 1], pos[k][j + 1], pos[k][j]
			local nr, ny = n2(j, j + 1)
			local nrm = Vector3.new(nr * sin(am), ny, nr * cos(am))   -- this band's outward direction
			if (pb - pa):Cross(pc - pa).Magnitude > 1e-12 then tri(M, a, b, c, ca, cb, cc, pa, pb, pc, nrm) end
			if (pc - pa):Cross(pd - pa).Magnitude > 1e-12 then tri(M, a, c, d, ca, cc, cd, pa, pc, pd, nrm) end
		end
	end
end

-- the room as the steel sees it (directions in world space, from the switch): exhibit.js's environment map
local P0 = Vector3.new(SW.x, PLINTH.h + 0.02, SW.z)
local POOL = Vector3.new(0, Geo.POOL_CENTER_Y, Geo.WALL_Z)
local POOL_DIR = (POOL - P0).Unit
local POOL_COS = cos(math.atan(1.75 / (POOL - P0).Magnitude))
local DOWN_DIR = (Vector3.new(0.6, 3.1, 1.95) - P0).Unit
local LAMP_DIR = (Geo.LAMP - P0).Unit
local function ss(a, b, x) local k = clamp((x - a) / (b - a), 0, 1); return k * k * (3 - 2 * k) end
local function env(R, lamp, blur)
	local e = 0.1                                                               -- the dim room
	e += lamp * 1.15 * ss(POOL_COS - 0.05 - blur, POOL_COS + 0.04, R:Dot(POOL_DIR))   -- the lamp's pool on the wall
	e += lamp * 1.8 * ss(0.78 - blur, 0.985, R:Dot(LAMP_DIR))                   -- the lamp itself, behind the viewer: a broad sheen
	e += 2.6 * ss(0.985 - blur, 0.998, R:Dot(DOWN_DIR)) + 0.35 * ss(0.88, 0.99, R:Dot(DOWN_DIR))   -- the downlight
	if R.Y < 0 then e += 0.7 * ss(0, 0.25 + blur, -R.Y) end                       -- the white plinth below
	return e
end

local FINISH = {
	steel = { tint = Vector3.new(0.96, 0.97, 0.98), blur = 0.0 },
	brushed = { tint = Vector3.new(0.85, 0.86, 0.88), blur = 0.05 },
}
-- Neon shows a colour about 1.75 times brighter than it is set: shade in display terms, then scale back
local NEON = 1 / 1.75

local function shade(M, part, camPos, lamp)
	local cf = part.CFrame
	local em = M.em
	for i = 1, #M.pos do
		local p = cf * M.pos[i]
		local n = cf:VectorToWorldSpace(M.nrm[i])
		local v = (p - camPos).Unit
		local R = v - n * (2 * v:Dot(n))
		local f = M.fin[i]
		local fres = 0.85 + 0.15 * (1 - max(0, -v:Dot(n))) ^ 5   -- polished metal: mostly mirror, a touch more at grazing
		local e = env(R, lamp, f.blur) * fres + 0.03 * max(0, n.Y)
		local k = (1 - math.exp(-1.6 * e)) * NEON                  -- a soft shoulder, so highlights glow rather than clip
		em:SetColor(M.col[i], Color3.new(clamp(f.tint.X * k, 0, 1), clamp(f.tint.Y * k, 0, 1), clamp(f.tint.Z * k, 0, 1)))
	end
end

local function part(M, name, parent)
	local mp = AssetService:CreateMeshPartAsync(Content.fromObject(M.em))
	mp.Name = name
	mp.Anchored, mp.CanCollide, mp.CanQuery, mp.CanTouch, mp.CastShadow = true, false, false, false, false
	mp.Color, mp.Material = Color3.new(1, 1, 1), Enum.Material.Neon
	mp.Parent = parent
	return mp
end

-- builds the switch at its place on the plinth; returns the lever part and shade(cameraPosition, lampLevel)
return function(parent)
	local base = CFrame.new(SW.x * S, PLINTH.h * S + 0.003, SW.z * S)   -- (a hair above the plinth's painted top)
	local model = Instance.new("Model")
	model.Name = "SwitchMesh"
	model.Parent = parent
	-- runtime meshes are limited in number: the body (washer, bushing, nut, cap) is one mesh, the lever another
	local body = newMesh(8)   -- (wide bounds: it also carries the downlight's glow on the floor, see below)
	-- washer with rounded edges
	lathe(body, { { 0, 0 }, { 0.0155, 0 }, { 0.0162, 0.0004 }, { 0.0162, 0.0011 }, { 0.0155, 0.0015 }, { 0, 0.0015 } }, 32, 0, FINISH.brushed)
	-- threaded bushing
	local th = { { 0, 0.0015 } }
	for i = 0, 40 do
		local y = 0.0015 + i / 40 * 0.0135
		table.insert(th, { 0.0059 + 0.00028 * sin(y / 0.0011 * pi * 2), y })
	end
	table.insert(th, { 0.0054, 0.0158 }); table.insert(th, { 0, 0.0158 })
	lathe(body, th, 24, 0, FINISH.brushed)
	-- hex nut with chamfered edges, the threaded hole through it
	local ro, ri, b, y0, y1 = 0.0115, 0.0062, 0.0007, 0.0015, 0.0063
	lathe(body, { { ri, y0 }, { ro - b, y0 }, { ro, y0 + b }, { ro, y1 - b }, { ro - b, y1 }, { ri, y1 }, { ri, y0 } }, 6, pi / 6, FINISH.steel, true)
	-- domed pivot cap the lever emerges from
	lathe(body, smooth({ { 0.0056, 0.0154 }, { 0.005, 0.0172 }, { 0.0035, 0.0184 }, { 0.0016, 0.019 }, { 0, 0.0191 } }, 10), 28, 0, FINISH.steel)
	-- The downlight's pool on the floor round the plinth, as in exhibit.js's room view: an unlit disc whose vertex
	-- colours fall from the lit floor at its centre to the dark floor at its rim. It rides in the switch body's mesh
	-- (runtime meshes are limited in number), placed relative to the switch.
	do
		local em = body.em
		local centre = Vector3.new((PLINTH.x + 0.04 - SW.x) * S, -(PLINTH.h * S + 0.003) + 0.08, (PLINTH.z + 0.12 - SW.z) * S)
		local R, RINGS, SEGS = 2.1 * S, 14, 48
		local FLOOR, LIT = Vector3.new(24, 25, 28) / 255, Vector3.new(172, 169, 163) / 255
		local function colourAt(r)
			-- brightest round the plinth's foot (r ≈ 0.2), falling to the dark floor at the rim
			local k = (1 - ss(0.1, 1, r)) ^ 1.1   -- a broad, gentle falloff
			local c = FLOOR + (LIT / 1.75 - FLOOR) * k   -- (lit end set dimmer: Neon shows bright colours ~1.75 times brighter)
			return em:AddColor(Color3.new(c.X, c.Y, c.Z), 1)
		end
		local up = em:AddNormal(Vector3.yAxis)
		local ids, cols = { [0] = { em:AddVertex(centre) } }, { [0] = { colourAt(0) } }
		for r = 1, RINGS do
			ids[r], cols[r] = {}, {}
			local cr = colourAt(r / RINGS)
			for k = 0, SEGS - 1 do
				local a = k / SEGS * 2 * pi
				ids[r][k] = em:AddVertex(centre + Vector3.new(cos(a), 0, sin(a)) * (R * r / RINGS))
				cols[r][k] = cr
			end
		end
		local function face(a, b, c, ca, cb, cc)
			local f = em:AddTriangle(a, c, b)   -- wound to face up
			em:SetFaceColors(f, { ca, cc, cb })
			em:SetFaceNormals(f, { up, up, up })
		end
		for k = 0, SEGS - 1 do
			local k2 = (k + 1) % SEGS
			face(ids[0][1], ids[1][k], ids[1][k2], cols[0][1], cols[1][k], cols[1][k2])
			for r = 1, RINGS - 1 do
				face(ids[r][k], ids[r + 1][k], ids[r + 1][k2], cols[r][k], cols[r + 1][k], cols[r + 1][k2])
				face(ids[r][k], ids[r + 1][k2], ids[r][k2], cols[r][k], cols[r + 1][k2], cols[r][k2])
			end
		end
	end
	local bodyPart = part(body, "Body", model)
	bodyPart.CFrame = base
	-- one smooth bat-handle lever: slim neck, swelling to a rounded teardrop tip
	local lm = newMesh()
	lathe(lm, smooth({
		{ 0, -0.0016 }, { 0.0021, -0.0012 }, { 0.0021, 0.004 }, { 0.0018, 0.012 }, { 0.0017, 0.019 },
		{ 0.0019, 0.025 }, { 0.0026, 0.0298 }, { 0.0032, 0.0328 }, { 0.0031, 0.0352 }, { 0.0019, 0.0365 }, { 0, 0.0368 },
	}, 32), 28, 0, FINISH.steel)
	local lever = part(lm, "Lever", model)
	lever.CFrame = base * CFrame.new(0, SW.pivot * S, 0)
	local lastCam, lastLever, lastLamp = nil, nil, -1
	return lever, function(camPos, lamp)
		-- only when something the reflections depend on has moved, and the viewer is near enough to see them
		if (camPos - bodyPart.Position).Magnitude > 40 then return end
		local moved = not lastCam or (camPos - lastCam).Magnitude > 1e-3 or math.abs(lamp - lastLamp) > 0.01
		if moved then shade(body, bodyPart, camPos, lamp) end
		if moved or lever.CFrame ~= lastLever then shade(lm, lever, camPos, lamp) end
		lastCam, lastLever, lastLamp = camPos, lever.CFrame, lamp
	end
end
