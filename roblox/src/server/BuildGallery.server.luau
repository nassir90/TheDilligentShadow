-- Builds the gallery when the server starts: the room, the plinth and its toggle switch, the lamp and the
-- downlight, at the web version's proportions (exhibit.js, metres) scaled to studs. Everything the lamp
-- draws on the wall (the figure, her chair, the lever's and the hand's shadows) is drawn by the client.
local G = workspace:FindFirstChild("Gallery")
if G then return end

local Shared = require(game.ReplicatedStorage:WaitForChild("DiligentShadow"):WaitForChild("Geometry"))
local S, PLINTH, SW, LAMP, WALL_Z = Shared.S, Shared.PLINTH, Shared.SW, Shared.LAMP, Shared.WALL_Z
local function V(x, y, z) return Vector3.new(x * S, y * S, z * S) end

G = Instance.new("Folder")
G.Name = "Gallery"

local function part(props)
	local p = Instance.new(props.Class or "Part")
	props.Class = nil
	p.Anchored = true
	p.TopSurface, p.BottomSurface = Enum.SurfaceType.Smooth, Enum.SurfaceType.Smooth
	p.Material = Enum.Material.SmoothPlastic
	for k, v in props do p[k] = v end
	p.Parent = p.Parent or G
	return p
end

-- the room: a dark floor and a pale wall that is dark until the lamp reaches it
local DARK = Color3.fromRGB(22, 23, 26)
part { Name = "Floor", Size = V(30, 0.25, 30), Position = V(0, -0.125, 3), Color = Color3.fromRGB(43, 44, 48), Material = Enum.Material.Concrete }
part { Name = "Wall", Size = V(30, 14, 0.25), Position = V(0, 7, WALL_Z - 0.125), Color = Color3.fromRGB(201, 204, 208) }
part { Name = "BackWall", Size = V(30, 14, 0.25), Position = V(0, 7, 18.125), Color = DARK }
part { Name = "SideL", Size = V(0.25, 14, 22), Position = V(-15.125, 7, 7), Color = DARK }
part { Name = "SideR", Size = V(0.25, 14, 22), Position = V(15.125, 7, 7), Color = DARK }
part { Name = "Ceiling", Size = V(30, 0.25, 22), Position = V(0, 14.125, 7), Color = DARK }

-- the plinth: its shadow is drawn by the client as the ledge she lives on
part { Name = "Plinth", Size = V(PLINTH.size, PLINTH.h, PLINTH.size), Position = V(PLINTH.x, PLINTH.h / 2, PLINTH.z),
	Color = Color3.fromRGB(228, 226, 220), CastShadow = false }

-- the panel toggle switch: each client turns it on a lathe (ReplicatedStorage.DiligentShadow.Switch); here only
-- the pivot the prompts hang on
local sw = Instance.new("Model")
sw.Name = "Switch"
sw.Parent = G
local pivot = part { Name = "Pivot", Parent = sw, Size = V(0.004, 0.004, 0.004), Position = V(SW.x, PLINTH.h + SW.pivot, SW.z),
	Transparency = 1, CanCollide = false, CanQuery = false, CastShadow = false }
-- a generous invisible grab volume around the switch, for the pointer
part { Name = "Grab", Parent = sw, Size = V(0.075, 0.075, 0.06), Position = V(SW.x, PLINTH.h + 0.035, SW.z),
	Transparency = 1, CanCollide = false, CastShadow = false }

-- the lamp: no visible body, only its light, aimed at the middle of the pool
local lamp = part { Name = "Lamp", Size = V(0.05, 0.05, 0.05), Transparency = 1, CanCollide = false, CanQuery = false, CastShadow = false,
	CFrame = CFrame.lookAt(V(LAMP.X, LAMP.Y, LAMP.Z), V(0, Shared.POOL_CENTER_Y, WALL_Z)) }
local beam = Instance.new("SpotLight")
beam.Name = "Beam"
beam.Face, beam.Angle, beam.Range = Enum.NormalId.Front, 48, 60
beam.Brightness, beam.Shadows, beam.Color = 2.2, true, Color3.fromRGB(242, 246, 255)
beam.Parent = lamp
-- the overhead downlight: a wide soft cone over the plinth and the floor round it
local down = part { Name = "Downlight", Size = V(0.05, 0.05, 0.05), Transparency = 1, CanCollide = false, CanQuery = false, CastShadow = false,
	CFrame = CFrame.lookAt(V(0.6, 3.1, 1.95), V(PLINTH.x + 0.04, 0.55, PLINTH.z + 0.12)) }
local dl = Instance.new("SpotLight")
dl.Name = "Light"
dl.Face, dl.Angle, dl.Range = Enum.NormalId.Front, 60, 36
dl.Brightness, dl.Shadows, dl.Color = 1.4, true, Color3.fromRGB(255, 241, 223)
dl.Parent = down

-- visitors arrive behind the lamp, facing the wall
local spawn = Instance.new("SpawnLocation")
spawn.Name = "Spawn"
spawn.Anchored, spawn.CanCollide, spawn.Transparency = true, false, 1
spawn.Size = Vector3.new(4, 0.2, 4)
spawn.CFrame = CFrame.lookAt(V(0, 0, 4.2), V(0, 0, 0)) + Vector3.new(0, 0.1, 0)
spawn.Neutral, spawn.Duration = true, 0
spawn.Parent = G
local dec = spawn:FindFirstChildOfClass("Decal")
if dec then dec:Destroy() end

G.Parent = workspace
