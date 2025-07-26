# skinview3d-blockbench

**Blockbench animation provider for [skinview3d](https://github.com/bs-community/skinview3d).**  
Allows you to load and play `.animation.json` files exported from Blockbench directly in your `SkinViewer` instance.

This package provides the `SkinViewBlockbench` class, which interprets and dynamically plays animations on Minecraft skin models.

---

## 📦 Installation

```bash
npm install skinview3d-blockbench
```

---

## 🚀 Quick Start

```ts
import { SkinViewer } from 'skinview3d';
import { BlockbenchAnimationProvider } from 'skinview3d-blockbench';
import animation from './player.animation.json';

const viewer = new SkinViewer({
  canvas: document.getElementById("skin_container"),
  width: 500,
  height: 500,
  skin: "/skin.png"
});

viewer.animation = new BlockbenchAnimationProvider({
  // The animation object. Can be imported as JSON or loaded via fetch.
  animation: animation,

  // [Optional] Name of the animation to play.
  // If not provided, the first animation in the file will be used.
  animationName: "1_anim",

  // [Optional] Override bone names if you're using custom ones.
  bonesOverrides: {
    leftLeg: "LLeg"
  },

  // [Optional] Force the animation to loop.
  // If not provided, the loop setting from the animation will be used.
  forceLoop: true,

  // [Optional] Attach the cape to the body if it's not animated.
  connectCape: false
});
```

---

## ⚙️ Before You Start

Before exporting animations from Blockbench, **you must properly configure the project**. Otherwise, exported data may not work correctly with `skinview3d`.

---

## 🛠️ Setting Up a Project in Blockbench

### 1. Create a new project

* Open Blockbench and create a new project using the **"Minecraft Skin"** template.
* **Important:** Make sure to **disable the "Pose" checkbox** before creating the project.  
  *This is required to avoid incorrect pivot positions.*

### 2. Convert to Bedrock Entity

* Go to `File → Convert Project → Bedrock Entity`.

### 3. Set Pivot Points

In the `Animate → Pivot Point` menu, set the following pivot values for each body part:

| Bone      | Pivot Point (X, Y, Z) |
| --------- | --------------------- |
| Head      | (0, 24, 0)            |
| Body      | (0, 18, 0)            |
| Left Arm  | (-5, 23, 0)           |
| Right Arm | (5, 23, 0)            |
| Left Leg  | (-2, 12, 0)           |
| Right Leg | (2, 12, 0)            |

These coordinates match the bone positions expected by `skinview3d`.

### 4. Creating and Exporting an Animation

* Go to the **Animate** tab and create a new animation.
* It's strongly recommended to use **Bezier Interpolation** instead of **Smooth Interpolation**, which currently behaves inconsistently.
* Once your animation is complete, click the **save icon next to its name** to export it as a `.animation.json` file.

You can then import this file into your project as shown in the usage example above.

---
**Created by AndcoolSystems with ❤, 26 July, 2025**