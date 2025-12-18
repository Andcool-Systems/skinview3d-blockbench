# skinview3d-blockbench

**Blockbench animation provider for [skinview3d](https://github.com/bs-community/skinview3d).**  
Allows you to load and play `.animation.json` files exported from Blockbench directly in your `SkinViewer` instance.

This package provides the `SkinViewBlockbench` class, which interprets and dynamically plays animations on Minecraft skin models.

<img src="readme/preview.gif" style="width: 100%" />  
---

## 📦 Installation

```bash
npm install skinview3d-blockbench
```

---

## 🚀 Quick Start

```ts
import { SkinViewer } from 'skinview3d';
import { SkinViewBlockbench } from 'skinview3d-blockbench';
import animation from './player.animation.json';

function main() {
  const viewer = new SkinViewer({
    canvas: document.getElementById("skin_container"),
    width: 500,
    height: 500,
    skin: "/skin.png"
  });

  const animation = new SkinViewBlockbench({
    // The animation object. Can be imported as JSON or loaded via fetch.
    animation: animation,

    // [Optional] Name of the animation to play.
    // If not provided, the first animation in the file will be used.
    animationName: "anim",

    // [Optional] Override bone names if you're using custom ones.
    bonesOverrides: {
      leftLeg: "LLeg"
    },

    // [Optional] Force the animation to loop.
    // If not provided, the loop setting from the animation will be used.
    forceLoop: true,

    // [Optional] Attach the cape to the body if it's not animated.
    connectCape: false


    // [Optional] Callback, that will be called after one-iteration animation finished.
    onFinish: (animation: SkinViewBlockbench) => {}

    // [Optional] Callback, that will be called after infinite animation loop ends.
    onLoopEnd: (animation: SkinViewBlockbench) => {}
  });

  viewer.animation = animation; // Apply the animation to the SkinView instance

  console.log(animation.animationIteration); // Currently playing animation iteration
  console.log(animation.animationName); // Currently playing animation name

  animation.resetPose(); // Reset player' position

  // Set animation from already loaded animations by name
  //
  // Note: If you want to load animation from another file or object,
  // you need to re-create entire animation object, what not recommended!
  animation.setAnimation({
    animationName: "name",
    forceLoop: true,
    connectCape: false
  });
}
```

> [!WARNING]
> Applying an animation provider to your SkinView3D instance can change the 3D structure of the skin (for example, combining the body and cape into one group). Therefore, if you are going to use *other* animations other than SkinViewBlockbench, we recommend recreating the entire SkinView3D instance. 
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
* You can also create groups of `Torso` and `All`, in which you can place their corresponding body parts (Head, Body and Arms for `Torso` and all body parts for `All'). You can also set overlays for the names of these groups in the animation configuration.
* Once your animation is complete, click the **save icon next to its name** to export it as a `.animation.json` file.

You can then import this file into your project as shown in the usage example above.

---
**Created by AndcoolSystems with ❤, 26 July, 2025**