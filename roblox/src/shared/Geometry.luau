-- The exhibit's geometry, in metres, exactly as exhibit.js has it. S converts metres to studs:
-- at 3 studs a metre a Roblox avatar (5 studs) stands about 1.7 m tall beside the 1.1 m plinth.
local G = {}
G.S = 3
G.WALL_Z = -4
G.PLINTH = { x = 0, z = 0.6, size = 0.65, h = 1.1 }
-- panel toggle switch: lever pivots 17.5 mm above the plinth, bat handle 36.8 mm long
G.SW = { x = 0.02, z = 0.8, pivot = 0.0175, lever = 0.0368, tipC = 0.0335, maxTilt = 0.42 }
G.LAMP = Vector3.new(0, 0.95, 2.6)
local LAMP, WALL_Z = G.LAMP, G.WALL_Z
function G.ratio(z) return (LAMP.Z - WALL_Z) / (LAMP.Z - z) end
G.FRONT_Z = G.PLINTH.z + G.PLINTH.size / 2
G.LEDGE_Y = LAMP.Y + (G.PLINTH.h - LAMP.Y) * G.ratio(G.FRONT_Z)   -- top edge of the plinth's shadow on the wall
G.POOL_CENTER_Y = G.LEDGE_Y + 1.75
-- where a point's shadow lands on the wall, relative to the ledge (x, y)
function G.shadowOf(v)
	local k = G.ratio(v.Z)
	return LAMP.X + (v.X - LAMP.X) * k, LAMP.Y + (v.Y - LAMP.Y) * k - G.LEDGE_Y
end
-- The shadow stage: the figure and chair stand 14 cm in front of the wall, scaled toward the lamp so that a
-- stage-local point (x, y, 0) casts onto the wall at (x, LEDGE_Y + y).
G.STAGE_Z = WALL_Z + 0.14
G.stageK = (LAMP.Z - WALL_Z) / (LAMP.Z - G.STAGE_Z)
G.STAGE_POS = Vector3.new(LAMP.X * (1 - 1 / G.stageK), LAMP.Y + (G.LEDGE_Y - LAMP.Y) / G.stageK, G.STAGE_Z)
-- the shadow-floor: the plane through the lamp whose points cast exactly onto the ledge's edge
G.SHADOW_FLOOR = (G.LEDGE_Y - LAMP.Y) / (LAMP.Z - WALL_Z)
return G
