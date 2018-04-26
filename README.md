Wave Function Collapse
======================

We did WFC for our final project. It is a tile based alogrithm for procedural buildings/structures or almost anything that can be given adjacency constraints.


![](screens/overhead.png)

![](screens/top.png)

![](screens/closeup.png)

We defined a set of constraints (a lot of them) to generate such structures. There are some limitations and drawbacks to WFC (explained later). But these drawbacks can be eliminated with a bit more standardizing the rules / constraints for the scene.


## Notes:

Only runs on Windows. There is an issue with macOS running opengl instancing with deferred renderer.


## Demo Link:

[Click Here](https://vasumahesh1.github.io/WFC_WebGL/)


## Navigating the UI

- New WFC Scene:
  This will re-run the algorithm for you. It will generate a new scene.

- Show States / Jump One State:
  Use this to navigate individual algorithm steps. Useful for debugging. To use this, one must turn on the `Capture States` toggle. Note: Capture states will take a long time and may even crash for large scenes due to array overflow. Use it for 8x8 scenes or below!

- Disable Orthographic Camera / `isStatic` under Camera Controls 




## How it works

The following states are Captured by our algorithm's implementation for debugging a scene's creation. Note: avoid using "Capture Scene" for large scenes.

WFC works by getting two inputs:
- Tiles  / Voxels
- Adjacency Information

Using that we build a adjacency matrix which is of the format:
`bool AdjacenyMatrix[Direction][Tile][Tile]`
which basically says that in Direction d (+x +y -x -y +z -z) does Tile `t1` have Tile `t2` as a neighbor.
Also, `t1` and `t2` are two tiles that can be rotated or mirrored versions.


Using this matrix we run an algorithm:

![](screens/algo.PNG)


### `Initialize()`
In this phase each Output Tile gets all the possible tiles. The algorithm works by eliminating Tiles until each Output Tile is left with 1 input tile.


### `Observe()`
The observation part’s goal is to mark some output tiles/voxels as “observed”. Once a tile has been marked as changed, the propagator “propagates” from those changes. The output tile which needs to "observed” is selected in a probabilistic manner which is based on the number of input tiles remaining in that output tile. Then, The selection of input tiles in that output tile is a weighted random. 


### `Propagate()`
The propagator uses the AdjacencyMatrix as described above on “observed” tiles/voxels. It scans 6 directions in the neighborhood (+x +y -x -y +z -z) and removes tiles which can’t be adjacent to the selected input tile in the observed tile / voxel. If it does that, the neighbor is also marked as “observed”. This keeps on going until there are no “observed” output tiles remaining.
It might come to you that there is a case of infinite loop, but that doesn’t happen because the Observe() part checks if there is a contradiction i.e. An Output Tile has 0 tiles left. If it does spot one, it terminates.
There are two ways the author told us to get around this. One is to use a backtracking method, to fallback to a more valid state and weighted randomly select a different input tile in the observed phase. Or, we can re-run the algorithm. The runtime doesn’t seem bad for the algorithm around 3-4s for a basic structure (as per the author).



### Simple Scene Build up

The below scene is illustrated in the gif below it. It basically shows how the algorithm ends up building this scene. More information can be found on the design doc.

![](screens/5x5scene.png)


GIF: 

![](screens/algorithm_gif.gif)



## Tiles / Voxels used:

The following voxels were used by us for making the scene. We created them on MagicaVoxel. And they look janky af.


|:-------------:|:-----:|:-----:|
| ![](screens/Capture1.PNG) | ![](screens/Capture2.PNG) | ![](screens/Capture3.PNG) |
| ![](screens/Capture4.PNG) | ![](screens/Capture5.PNG) | ![](screens/Capture6.PNG) |
| ![](screens/Capture7.PNG) | ![](screens/Capture8.PNG) | ![](screens/Capture9.PNG) |
| ![](screens/Capture10.PNG) | ![](screens/Capture11.PNG) | ![](screens/Capture12.PNG) |
| ![](screens/Capture13.PNG) | ![](screens/Capture14.PNG) | ![](screens/Capture15.PNG) |
| ![](screens/Capture16.PNG) | ![](screens/Capture17.PNG) | ![](screens/Capture18.PNG) |
| ![](screens/Capture19.PNG) |  |  |



## References

- [WFC Original Repo](https://github.com/mxgmn/WaveFunctionCollapse)