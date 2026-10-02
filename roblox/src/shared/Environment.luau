--!native
-- The room's light, painted on rather than lit: the lamp's pool on the wall (an unlit SurfaceGui image computed
-- from exhibit.js's lamp), the plinth's faces (unlit Neon skins) and the dark floor. Roblox's lighting
-- changes completely between graphics levels (on the lowest the pool smears across the whole wall), so painting
-- it is the only way the exhibit looks the same on every device. The shadows drawn in front use DARK, the colour
-- of the wall where no lamp light reaches, so a shadow reads exactly like the dark around the pool.
local AssetService = game:GetService("AssetService")
local Geo = require(script.Parent:WaitForChild("Geometry"))

local E = {}
E.DARK = Color3.fromRGB(14, 15, 17)        -- the wall with the lamp off, and every shadow on it
local WALL_TINT = Vector3.new(0.787, 0.8, 0.816)   -- 0xc9ccd0
local LIT = Vector3.new(0.95, 0.965, 0.985)        -- the pool's white

local clamp, sqrt, max, cos = math.clamp, math.sqrt, math.max, math.cos
local function ss(a, b, x) local k = clamp((x - a) / (b - a), 0, 1); return k * k * (3 - 2 * k) end
-- filmic shoulder (an ACES-like curve) so the pool's centre rolls off into white instead of clipping flat
local function tone(x) x = max(0, x); return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0, 1) end

local function surfaceGui(part, face, name)
	local g = Instance.new("SurfaceGui")
	g.Name = name
	g.Face = face
	g.LightInfluence = 0
	g.Brightness = 1
	g.SizingMode = Enum.SurfaceGuiSizingMode.PixelsPerStud
	g.PixelsPerStud = 8
	g.ZIndexBehavior = Enum.ZIndexBehavior.Sibling
	g.Parent = part
	return g
end
local function fill(parent, color, z)
	local f = Instance.new("Frame")
	f.Size = UDim2.fromScale(1, 1)
	f.BorderSizePixel = 0
	f.BackgroundColor3 = color
	f.ZIndex = z or 1
	f.Parent = parent
	return f
end

-- the lamp's pool on the wall: exhibit.js's SpotLight (angle 0.42, penumbra 0.22, no distance falloff) aimed at
-- the pool centre, times the wall's tilt to the lamp, plus the soft bounce the bright pool throws round itself
local function poolImage(x0, x1, y0, y1, w, h)
	local L, WZ = Geo.LAMP, Geo.WALL_Z
	local T = Vector3.new(0, Geo.POOL_CENTER_Y, WZ)
	local axis = (T - L).Unit
	local cosOuter, cosInner = cos(0.42), cos(0.42 * (1 - 0.22))
	local B = Vector3.new(0, Geo.POOL_CENTER_Y - 0.5, WZ + 1.5)
	local buf = buffer.create(w * h * 4)
	for py = 0, h - 1 do
		local y = y1 - (py + 0.5) / h * (y1 - y0)
		local ao = 0.3 + 0.7 * ss(0, 0.9, y)   -- the wall darkens toward the floor
		for px = 0, w - 1 do
			local x = x0 + (px + 0.5) / w * (x1 - x0)
			local P = Vector3.new(x, y, WZ)
			local d = P - L
			local dist = d.Magnitude
			local dir = d / dist
			local spot = ss(cosOuter, cosInner, dir:Dot(axis))
			local ndl = max(0, -dir.Z)
			local bd = (P - B).Magnitude
			local bounce = 0.38 * clamp(1 - bd / 7.5, 0, 1) ^ 2 * max(0, (B.Z - WZ) / bd)
			local e = (2.2 * spot * ndl + bounce) * ao
			local k = tone(e * 0.95)
			local o = (py * w + px) * 4
			buffer.writeu8(buf, o, math.floor(255 * clamp(LIT.X * k + 0.002, 0, 1)))
			buffer.writeu8(buf, o + 1, math.floor(255 * clamp(LIT.Y * k + 0.002, 0, 1)))
			buffer.writeu8(buf, o + 2, math.floor(255 * clamp(LIT.Z * k + 0.002, 0, 1)))
			buffer.writeu8(buf, o + 3, math.floor(255 * clamp(k * 1.05, 0, 1)))   -- the pool over the dark wall
		end
	end
	local img = AssetService:CreateEditableImage({ Size = Vector2.new(w, h) })
	img:WritePixelsBuffer(Vector2.zero, Vector2.new(w, h), buf)
	return img
end

-- paints the gallery; returns setLamp(level 0..1)
function E.paint(gallery)
	local S = Geo.S
	local wall, plinth, floor = gallery:WaitForChild("Wall"), gallery:WaitForChild("Plinth"), gallery:WaitForChild("Floor")
	-- the wall: dark everywhere, the pool painted over it (the image spans x -4.5..4.5 m, y 0..7 m)
	local wg = surfaceGui(wall, Enum.NormalId.Back, "Pool")
	fill(wg, E.DARK, 1)
	local X0, X1, Y0, Y1 = -4.5, 4.5, 0, 7
	local pool = Instance.new("ImageLabel")
	pool.BackgroundTransparency = 1
	pool.ImageContent = Content.fromObject(poolImage(X0, X1, Y0, Y1, 288, 224))
	pool.ZIndex = 2
	-- the SurfaceGui's canvas maps the wall's face; place the image by metres from the wall's left and top edges
	local ww, wh = wall.Size.X / S, wall.Size.Y / S
	local wx0, wtop = wall.Position.X / S - ww / 2, wall.Position.Y / S + wh / 2
	pool.Position = UDim2.fromScale((X0 - wx0) / ww, (wtop - Y1) / wh)
	pool.Size = UDim2.fromScale((X1 - X0) / ww, (Y1 - Y0) / wh)
	pool.Parent = wg

	-- the plinth: top lit by the downlight, front by the lamp, sides and back in shade. Thin unlit (Neon) skins on
	-- each face, not SurfaceGuis: a SurfaceGui draws over transparent things in front of it (the hand's dithered edge)
	local skin = Instance.new("Folder")
	skin.Name = "PlinthSkin"
	skin.Parent = gallery
	local pc, ps = plinth.Position, plinth.Size
	local function face(name, offset, size, color)
		local p = Instance.new("Part")
		p.Name = name
		p.Anchored, p.CanCollide, p.CanQuery, p.CanTouch, p.CastShadow = true, false, false, false, false
		p.Material, p.Color = Enum.Material.Neon, color
		p.Size = size
		p.Position = pc + offset
		p.Parent = skin
		return p
	end
	local t = 0.002
	-- (Neon shows a colour about 1.75 times brighter than it is set; these are set so they show as wanted)
	face("Top", Vector3.new(0, ps.Y / 2 + t / 2, 0), Vector3.new(ps.X, t, ps.Z), Color3.fromRGB(127, 126, 122))
	local frontLit, frontDark = Color3.fromRGB(133, 132, 129), Color3.fromRGB(33, 33, 32)
	-- the front, lit by the lamp, darkens toward the floor (exhibit.js shades the plinth's foot the same way), so it
	-- meets the downlight's glow on the floor at about the floor's own brightness; thin bands, too fine to see as steps
	local BANDS = 64
	local front = {}
	for i = 1, BANDS do
		local y0, y1 = (i - 1) / BANDS, i / BANDS
		local yc = (y0 + y1) / 2
		local band = face("Front" .. i, Vector3.new(0, -ps.Y / 2 + yc * ps.Y, ps.Z / 2 + t / 2), Vector3.new(ps.X, ps.Y / BANDS + 0.001, t), frontLit)
		-- (0.72 of the top at the foot: measured, that shows at about the floor glow's own brightness; Neon is not linear)
		local k = 0.72 + 0.28 * (function(x) x = math.clamp(x / 0.55, 0, 1); return x * x * (3 - 2 * x) end)(yc)
		table.insert(front, { part = band, k = k })
	end
	face("Left", Vector3.new(-ps.X / 2 - t / 2, 0, 0), Vector3.new(t, ps.Y, ps.Z), Color3.fromRGB(33, 33, 32))
	face("Right", Vector3.new(ps.X / 2 + t / 2, 0, 0), Vector3.new(t, ps.Y, ps.Z), Color3.fromRGB(33, 33, 32))
	face("Back", Vector3.new(0, 0, -ps.Z / 2 - t / 2), Vector3.new(ps.X, ps.Y, t), Color3.fromRGB(16, 16, 16))

	-- the floor: dark and unlit (Neon), the same stuff as the downlight's glow on it (Switch.luau), so they meet seamlessly
	floor.Material, floor.Color = Enum.Material.Neon, Color3.fromRGB(24, 25, 28)
	return function(level)
		pool.ImageTransparency = 1 - level
		for _, band in front do
			local lit = Color3.new(frontLit.R * band.k, frontLit.G * band.k, frontLit.B * band.k)
			band.part.Color = frontDark:Lerp(lit, level)
		end
	end
end

return E
