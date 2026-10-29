# Real offline recognition test using synthesized audio, not the user's microphone.
$ErrorActionPreference = 'Stop'
$speechRoot = Split-Path $PSScriptRoot -Parent
$speechOut = Join-Path $speechRoot '.caprigpt-local/speech-check'
New-Item -ItemType Directory -Path $speechOut -Force | Out-Null
Add-Type -AssemblyName System.Speech
$speechWave = Join-Path $speechOut 'known-speech.wav'
$speechSynth = New-Object System.Speech.Synthesis.SpeechSynthesizer
try {
  $speechSynth.SelectVoiceByHints([System.Speech.Synthesis.VoiceGender]::Male,
    [System.Speech.Synthesis.VoiceAge]::Adult, 0, [System.Globalization.CultureInfo]::GetCultureInfo('en-US'))
  $speechSynth.SetOutputToWaveFile($speechWave)
  $speechSynth.Speak('Hello. Please tell me a story about a little red robot.')
} finally { $speechSynth.Dispose() }
& node (Join-Path $speechRoot 'scripts/check-whisper.js')
if ($LASTEXITCODE -ne 0) { throw 'Whisper recognition check failed.' }
