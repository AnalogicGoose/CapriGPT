# Capri panel portrait

Asset: `portrait-blink.png`, two equal square frames, eyes open on the left and
eyes closed on the right. Generated with the built-in image generation tool.
References: existing `face-look.png` and `capri-face.png`. The original assets were
preserved. Blinking, glitch bands and visibility handling are implemented in
`src/renderer/js/portrait.js` rather than embedded in a continuously running GIF.

## Generation prompt

Create a polished game UI portrait sprite sheet of EXACTLY this red-haired neon-green-faced fictional cyberpunk character Capri, preserving the reference's graphic angular anime cel-art style and recognizable character identity: jagged crimson/hot magenta hair, black angular face framing, lime green face, black eye sockets with luminous cyan concentric eyes, jagged white grin. Asset: one 1536x1024 image organized as exactly TWO equal square 768x768 portrait tiles placed horizontally, centered vertically on a solid near-black plum background. Better use output aspect 2:1 with two equal square tiles. LEFT TILE: clean beautifully composed head and tiny shoulder bust looking straight at viewer, confident playful expression, BOTH EYES OPEN. RIGHT TILE: exact duplicate identical framing, hair, background, face and mouth, only BOTH EYES CLOSED in a natural blink. Absolutely no seam through faces; both characters centered at same position in respective square tile. Use clean sharp deliberate linework, angular shapes, restrained violet rim lighting, dark plum background, no gradients on character, no photorealism, no generic human face, no text or lettering, no labels, no added props, no UI borders. Face must occupy most of each tile so readable at 58px. Keep features aligned across tiles so a developer can crossfade the eye state. This is production sprite artwork, not a mockup.

The tool returned a 1774 × 887 sprite sheet; the renderer reads its actual dimensions.
