'use strict';

// Suggestions and display names, not a restriction on which apps can be allowed.
const NAMES = Object.freeze({ code: 'Visual Studio Code', chrome: 'Google Chrome',
  firefox: 'Firefox', msedge: 'Microsoft Edge', spotify: 'Spotify', discord: 'Discord',
  steam: 'Steam', steamwebhelper: 'Steam (desktop interface)', chatgpt: 'ChatGPT', codex: 'Codex',
  claude: 'Claude', notepad: 'Notepad', winword: 'Microsoft Word', excel: 'Microsoft Excel',
  powerpnt: 'Microsoft PowerPoint', obs64: 'OBS Studio', blender: 'Blender', resolve: 'DaVinci Resolve',
  vlc: 'VLC', goosic: 'Goosic', 'goosic.windows': 'Goosic', explorer: 'File Explorer',
  'windows terminal': 'Windows Terminal', windowsterminal: 'Windows Terminal' });
const friendlyName = name => NAMES[name.toLowerCase()] || name;
module.exports = { NAMES, friendlyName };
