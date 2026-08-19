import type Phaser from "phaser";

interface TextButtonOptions {
  x: number;
  y: number;
  width: number;
  height: number;
  label: string;
  onPress: () => void;
  backgroundColor?: number;
  fontSize?: string;
}

export function createTextButton(scene: Phaser.Scene, options: TextButtonOptions) {
  const background = scene.add
    .rectangle(options.x, options.y, options.width, options.height, options.backgroundColor ?? 0x0f4660)
    .setInteractive({ useHandCursor: true });
  const text = scene.add
    .text(options.x, options.y, options.label, {
      fontFamily: "sans-serif",
      fontSize: options.fontSize ?? "13px",
      color: "#ffffff",
    })
    .setOrigin(0.5);
  background.on("pointerdown", options.onPress);
  return scene.add.container(0, 0, [background, text]);
}
