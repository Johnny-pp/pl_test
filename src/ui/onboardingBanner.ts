import type Phaser from "phaser";
import { completeOnboardingStep, getPendingOnboardingStep, skipOnboarding } from "../onboarding/onboarding";
import { createTextButton } from "./button";
import { startScene } from "../scenes/sceneLoader";

/**
 * 在场景顶部渲染待展示的新手引导横幅（无待展示项时返回 undefined）。
 * 横幅支持「前往」「知道了」「跳过引导」三个操作。
 */
export function renderOnboardingBanner(scene: Phaser.Scene): Phaser.GameObjects.Container | undefined {
  const step = getPendingOnboardingStep(localStorage);
  if (!step) return undefined;
  const banner = scene.add.container(0, 0).setDepth(40);
  banner.add(
    scene.add
      .rectangle(450, 196, 820, 54, 0x0f3460, 0.97)
      .setStrokeStyle(2, 0x4fc3f7)
      .setName("onboarding-banner")
  );
  banner.add(
    scene.add
      .text(60, 196, `◆ ${step.title}：${step.text}`, {
        fontFamily: "sans-serif",
        fontSize: "14px",
        color: "#ffffff",
        wordWrap: { width: 560 },
      })
      .setOrigin(0, 0.5)
  );
  const close = () => {
    banner.destroy(true);
    if (scene.scene.isActive(scene.scene.key)) scene.scene.restart();
  };
  if (step.scene) {
    banner.add(
      createTextButton(scene, {
        x: 640,
        y: 196,
        width: 64,
        height: 30,
        label: "前往",
        variant: "accent",
        fontSize: "12px",
        onPress: () => {
          completeOnboardingStep(localStorage, step.id);
          void startScene(scene, step.scene!);
        },
      })
    );
  }
  banner.add(
    createTextButton(scene, {
      x: 720,
      y: 196,
      width: 76,
      height: 30,
      label: "知道了",
      variant: "primary",
      fontSize: "12px",
      onPress: () => {
        completeOnboardingStep(localStorage, step.id);
        close();
      },
    })
  );
  banner.add(
    createTextButton(scene, {
      x: 814,
      y: 196,
      width: 76,
      height: 30,
      label: "跳过引导",
      variant: "muted",
      fontSize: "12px",
      onPress: () => {
        skipOnboarding(localStorage);
        close();
      },
    })
  );
  return banner;
}
