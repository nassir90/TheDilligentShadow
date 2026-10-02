#!/usr/bin/env python3
"""Assemble roblox/TheDiligentShadow.rbxlx from roblox/src.

  src/shared/Geometry.luau            → ReplicatedStorage.DiligentShadow.Geometry (ModuleScript)
  src/assets/*.luau                   → ReplicatedStorage.DiligentShadow.Assets.* (ModuleScripts)
  src/server/BuildGallery.server.luau → ServerScriptService.BuildGallery (Script)
  src/client/DiligentShadow.client.luau → StarterPlayer.StarterPlayerScripts.DiligentShadow (LocalScript)

Run tools/prepare_assets.py first when the models change. Open the result in Roblox Studio.
"""
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'src')
_ref = [0]

def ref():
    _ref[0] += 1
    return f'RBX{_ref[0]:08X}'

def esc(s): return s.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')

def item(cls, name, props='', children=''):
    return f'<Item class="{cls}" referent="{ref()}"><Properties><string name="Name">{esc(name)}</string>{props}</Properties>{children}</Item>\n'

def script(cls, name, path):
    src = open(os.path.join(SRC, path)).read()
    assert ']]>' not in src
    return item(cls, name, f'<ProtectedString name="Source"><![CDATA[{src}]]></ProtectedString>')

def color3(name, r, g, b): return f'<Color3 name="{name}"><R>{r / 255}</R><G>{g / 255}</G><B>{b / 255}</B></Color3>'
def f(name, v): return f'<float name="{name}">{v}</float>'
def b(name, v): return f'<bool name="{name}">{"true" if v else "false"}</bool>'
def token(name, v): return f'<token name="{name}">{v}</token>'

def sky():
    # a dark room with soft light ahead (the pool) and above (the downlight), for whatever Roblox reflects (the hand's
    # sheen); the switch's steel is shaded by Switch.luau itself. Studio's own textures, so nothing needs uploading
    blob, dark = 'rbxasset://textures/shadowblurmask.png', 'rbxasset://textures/blackBkg_square.png'
    faces = {'SkyboxFt': blob, 'SkyboxUp': blob, 'SkyboxBk': dark, 'SkyboxDn': dark, 'SkyboxLf': dark, 'SkyboxRt': dark}
    props = ''.join(f'<Content name="{k}"><url>{v}</url></Content>' for k, v in faces.items())
    return item('Sky', 'Sky', props + b('CelestialBodiesShown', False) + f'<int name="StarCount">0</int>')

def main():
    assets = ''.join(script('ModuleScript', n[:-5], os.path.join('assets', n)) for n in sorted(os.listdir(os.path.join(SRC, 'assets'))) if n.endswith('.luau'))
    shared = ''.join(script('ModuleScript', n[:-5], os.path.join('shared', n)) for n in sorted(os.listdir(os.path.join(SRC, 'shared'))) if n.endswith('.luau'))
    ds = item('Folder', 'DiligentShadow', '', shared + item('Folder', 'Assets', '', assets))
    lighting = item('Lighting', 'Lighting',
                    token('Technology', 4)  # Future; the wall, plinth and floor are painted (Environment.luau), so lower graphics levels look the same
                    + color3('Ambient', 120, 118, 116) + color3('OutdoorAmbient', 8, 8, 10)
                    + f('Brightness', 0) + f('ClockTime', 0) + f('EnvironmentDiffuseScale', 0) + f('EnvironmentSpecularScale', 0.3)
                    + f('ExposureCompensation', 0.2) + b('GlobalShadows', True),
                    sky()
                    + item('ColorCorrectionEffect', 'Grade', f('Contrast', 0.06) + f('Saturation', -0.25))
                    + item('BloomEffect', 'Bloom', f('Intensity', 0.2) + f('Size', 30) + f('Threshold', 1.5)))
    xml = ('<roblox xmlns:xmime="http://www.w3.org/2005/05/xmlmime" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" '
           'xsi:noNamespaceSchemaLocation="http://www.roblox.com/roblox.xsd" version="4">\n'
           + item('Workspace', 'Workspace')
           + lighting
           + item('ReplicatedStorage', 'ReplicatedStorage', '', ds)
           # phones follow the way they are held: landscape or portrait (as the web version allows both)
           + item('StarterGui', 'StarterGui', token('ScreenOrientation', 4))
           + item('ServerScriptService', 'ServerScriptService', '', script('Script', 'BuildGallery', 'server/BuildGallery.server.luau'))
           + item('StarterPlayer', 'StarterPlayer', '', item('StarterPlayerScripts', 'StarterPlayerScripts', '', script('LocalScript', 'DiligentShadow', 'client/DiligentShadow.client.luau')))
           + '</roblox>\n')
    out = os.path.join(ROOT, 'TheDiligentShadow.rbxlx')
    open(out, 'w').write(xml)
    print(out, len(xml), 'bytes')

if __name__ == '__main__':
    main()
