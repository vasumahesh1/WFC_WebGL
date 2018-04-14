import {vec2, vec3, vec4, mat4, quat} from 'gl-matrix';

var _ = require('lodash');

function weightedRandom(arr: Array<number>, random: number) {
  let sum = 0;
  for (let i = 0; i < arr.length; ++i) {
    sum += arr[i];
  }

  if (sum == 0) {
    for (let i = 0; i < arr.length; ++i) {
      arr[i] = 1;
      sum += arr[i];
    }
  }

  for (let i = 0; i < arr.length; ++i) {
    arr[i] /= sum;
  }

  let idx = 0;
  let soFar = 0.0;

  while (idx < arr.length) {
    soFar += arr[idx];

    if (random <= soFar) {
      return idx;
    }

    idx++;
  }

  return 0;
}

function axisAngleToQuaternion(axis: vec3, angle: number) {
  let quat = vec4.create();
  let cos = Math.cos(angle / 2.0);
  let sin = Math.sin(angle / 2.0);

  let scaledAxis = vec3.create();
  vec3.scale(scaledAxis, axis, sin);

  quat[0] = scaledAxis[0];
  quat[1] = scaledAxis[1];
  quat[2] = scaledAxis[2];
  quat[3] = cos;

  return quat;
}

class TransformVoxel {
  mesh: string;
  position: vec4;
  rotation: vec4;
  scale: vec3;

  constructor(name: string) {
    this.mesh = name;
    this.position = vec4.fromValues(0,0,0,1);
    this.rotation = vec4.fromValues(0,0,0,1);
    this.scale = vec3.fromValues(1,1,1);
  }
}

class WFC {
  mapX: number;
  mapY: number;
  mapZ: number;
  ground: number;
  empty: number;
  sky: number;
  tileCount: number;
  periodic: boolean;
  captureState: boolean = false;
  states: any;

  actionCount: number;
  weights: Array<number>;
  propagator: Array<Array<Array<boolean>>>;

  waves: Array<Array<Array<Array<boolean>>>>;
  changes: Array<Array<Array<boolean>>>;
  observed: Array<Array<Array<number>>>;

  logProb: Array<number>;
  logT: number;

  pixelSize: number;
  voxelSize: number;

  firstOccurence: any;

  tileNames: Array<string>;
  transforms: Array<TransformVoxel>;

  constructor(name:string, subsetName:string, width:number, height:number, depth:number, periodic:boolean, groundName:string, emptyName:string, skyName:string) {
    this.mapX = width;
    this.mapY = height;
    this.mapZ = depth;

    this.periodic = periodic;
    this.ground = -1;
    this.empty = -1;
    this.sky = -1;

    this.states = [];

    this.weights = new Array<number>();
    this.tileNames = new Array<string>();
    this.transforms = new Array<TransformVoxel>();
    this.propagator = new Array<Array<Array<boolean>>>();

    let json = require('./wfc/data4.json');
    this.pixelSize = json.set.pixelsize;
    this.voxelSize = json.set.voxelsize;

    if (subsetName) {
      // TODO: Subsets
    }

    let actions = [];
    let firstOccurence:any = {};
    this.firstOccurence = firstOccurence;

    /*----------  Iterate through Tiles  ----------*/
    let tiles = json.set.tiles;
    for (var itr = 0; itr < tiles.length; ++itr) {
      let tile = tiles[itr];
      let tileName = tile["name"];
      let sym = tile["symmetry"] || "X";
      let weight = tile["weight"] >= 0.0 ? tile["weight"] : 1.0;
      let cardinality = 0;

      let funcA, funcB;

      if (sym == 'L') {
        cardinality = 4;
        funcA = (i:number) => { return (i + 1) % 4; };
        funcB = (i:number) => { return  i % 2 == 0 ? i + 1 : i - 1; };
      }
      else if (sym == 'T') {
        cardinality = 4;
        funcA = (i:number) => { return (i + 1) % 4; };
        funcB = (i:number) => { return  i % 2 == 0 ? i : 4 - i; };
      }
      else if (sym == 'I') {
        cardinality = 2;
        funcA = (i:number) => { return 1 - i; };
        funcB = (i:number) => { return i; };
      }
      else if (sym == '\\') {
        cardinality = 2;
        funcA = (i:number) => { return 1 - i; };
        funcB = (i:number) => { return 1 - i; };
      }
      else {
        cardinality = 1;
        funcA = (i:number) => { return i; };
        funcB = (i:number) => { return i; };
      }

      this.actionCount = actions.length;
      firstOccurence[tileName] = this.actionCount;
      if (tileName == groundName) {
        this.ground = this.actionCount;
      }

      if (tileName == emptyName) {
        this.empty = this.actionCount;
      }

      if (tileName == skyName) {
        this.sky = this.actionCount;
      }

      /*----------  Map Mirror & Rotated Tiles  ----------*/
      let map = new Array<Array<number>>();
      for (let t = 0; t < cardinality; t++) {
        let arr = new Array<number>(8);

        // Rotations
        arr[0] = t;
        arr[1] = funcA(t);
        arr[2] = funcA(funcA(t));
        arr[3] = funcA(funcA(funcA(t)));

        // Mirror of Rotations
        arr[4] = funcB(t);
        arr[5] = funcB(funcA(t));
        arr[6] = funcB(funcA(funcA(t)));
        arr[7] = funcB(funcA(funcA(funcA(t))));

        // Add Offsets since we push to global array
        for (let j = 0; j < 8; j++) {
          arr[j] += this.actionCount;
        }

        map.push(arr);
        actions.push(arr);
      }

      this.tileNames.push(`${tileName} 0`);
      this.transforms.push(new TransformVoxel(tileName));

      /*----------  Finally Rotate Transforms  ----------*/
      for (let t = 1; t < cardinality; t++) {
        this.tileNames.push(`${tileName} ${t}`);

        let transform = new TransformVoxel(tileName);
        transform.rotation = axisAngleToQuaternion(vec3.fromValues(0,0,1), t * Math.PI / 2.0);

        this.transforms.push(transform);
      }

      for (let t = 0; t < cardinality; t++) {
        this.weights.push(weight);
      }
    }

    this.actionCount = actions.length;

    // dims = +x +y -x -y +z -z
    for (let dims = 0; dims < 6; dims++) {
      let inner = new Array<Array<boolean>>();

      for (let t = 0; t < this.actionCount; t++) {
        let arr = new Array<boolean>(this.actionCount);

        for (let t2 = 0; t2 < this.actionCount; ++t2) {
          arr[t2] = false;
        }

        inner.push(arr);
      }

      this.propagator.push(inner);
    }

    this.waves = new Array<Array<Array<Array<boolean>>>>();
    this.changes = new Array<Array<Array<boolean>>>();
    this.observed = new Array<Array<Array<number>>>();

    // Prepare Map
    for (let x = 0; x < this.mapX; ++x) {
      let waveX = new Array<Array<Array<boolean>>>();
      let changesX = new Array<Array<boolean>>();
      let observedX = new Array<Array<number>>();

      for (let y = 0; y < this.mapY; ++y) {
        let waveY = new Array<Array<boolean>>();
        let changesY = new Array<boolean>(this.mapZ);
        let observedY = new Array<number>(this.mapZ);

        for (let z = 0; z < this.mapZ; ++z) {
          let waveZ = new Array<boolean>(this.actionCount);
          waveY.push(waveZ);

          observedY[z] = -1;
        }

        observedX.push(observedY);
        changesX.push(changesY);
        waveX.push(waveY);
      }

      this.observed.push(observedX);
      this.changes.push(changesX);
      this.waves.push(waveX);
    }

    console.log('Actions', actions);

    /*----------  Prepare Propagator which controls Adjacency  ----------*/
    let neighbors = json.set.neighbors;
    for (var itr = 0; itr < neighbors.length; ++itr) {
      let neighbor = neighbors[itr];
      let type = neighbor[0] || "horizontal";
      let leftArr = neighbor[1].split(' ');
      let rightArr = neighbor[2].split(' ');

      if (leftArr.length == 1) {
        leftArr.push("0");
      }

      if (rightArr.length == 1) {
        rightArr.push("0");
      }

      let L = actions[firstOccurence[leftArr[0]]][Number.parseInt(leftArr[1])];
      let D = actions[L][1];

      let R = actions[firstOccurence[rightArr[0]]][Number.parseInt(rightArr[1])];
      let U = actions[R][1];

      if (type == "horizontal") {
        this.propagator[0][R][L] = true;
        this.propagator[0][actions[R][6]][actions[L][6]] = true;
        this.propagator[0][actions[L][4]][actions[R][4]] = true;
        this.propagator[0][actions[L][2]][actions[R][2]] = true;

        this.propagator[1][U][D] = true;
        this.propagator[1][actions[D][6]][actions[U][6]] = true;
        this.propagator[1][actions[U][4]][actions[D][4]] = true;
        this.propagator[1][actions[D][2]][actions[U][2]] = true;
      }
      else {
        for (let itr2 = 0; itr2 < 8; itr2++) {
          this.propagator[4][actions[L][itr2]][actions[R][itr2]] = true;
        }
      }
    }

    for (let t2 = 0; t2 < this.actionCount; t2++) {
      for (let t1 = 0; t1 < this.actionCount; t1++) {
        this.propagator[2][t2][t1] = this.propagator[0][t1][t2];
        this.propagator[3][t2][t1] = this.propagator[1][t1][t2];
        this.propagator[5][t2][t1] = this.propagator[4][t1][t2];
      }
    }

    console.log('Propagator', this.propagator);
    console.log('firstOccurence', firstOccurence);
    console.log('transforms', this.transforms);
  }

  observedClone() {
    let savedState: Array<Array<Array<number>>> = [];

    // // Prepare Map
    // for (let x = 0; x < this.mapX; ++x) {
    //   let observedX = new Array<Array<number>>();

    //   for (let y = 0; y < this.mapY; ++y) {
    //     let observedY = new Array<number>(this.mapZ);

    //     for (let z = 0; z < this.mapZ; ++z) {
    //       observedY[z] = this.observed[x][y][z];
    //     }

    //     observedX.push(observedY);
    //   }

    //   savedState.push(observedX);
    // }

    this.states.push(_.cloneDeep(this.waves));
  }

  observe() {
    let min = 1000;
    let sum = 0;
    let amount = 0;
    let mainSum = 0;
    let logSum = 0;
    let noise, entropy;

    // Lowest Entropy Coordinate Selection
    let selectedX = -1, selectedY = -1, selectedZ = -1;
    let w = Array<boolean>();

    for (let x = 0; x < this.mapX; ++x) {
      for (let y = 0; y < this.mapY; ++y) {
        for (let z = 0; z < this.mapZ; ++z) {

          w = this.waves[x][y][z];
          amount = 0;
          sum = 0;

          for (let t = 0; t < this.actionCount; ++t) {
            if (w[t]) {
              amount += 1;
              sum += this.weights[t];
            }
          }

          if (sum == 0) {
            // console.log('Wave', w);
            // console.log('XYZ', x,y,z);
            return false;
          }

          noise = 1E-6 * Math.random();

          // Only 1 Tile Valid, So Entropy must be lowest.
          if (amount == 1) {
            entropy = 0;
          }
          else if (amount == this.actionCount) {
            entropy = this.logT;
          }
          else {
            mainSum = 0;
            logSum = Math.log(sum);

            for (let t = 0; t < this.actionCount; t++) {
              if (w[t]) {
                mainSum += this.weights[t] * this.logProb[t];
              }
            }

            entropy = logSum - mainSum / sum;
          }


          if (entropy > 0 && entropy + noise < min) {
            min = entropy + noise;
            selectedX = x;
            selectedY = y;
            selectedZ = z;
          }
        }
      }
    }

    // No Tile Got Selected!
    if (selectedX == -1 && selectedY == -1 && selectedZ == -1) {
      // Iterate Start
      for (let x = 0; x < this.mapX; ++x) {
        for (let y = 0; y < this.mapY; ++y) {
          for (let z = 0; z < this.mapZ; ++z) {
            for (let t = 0; t < this.actionCount; ++t) {
              if (this.waves[x][y][z][t]) {
                this.observed[x][y][z] = t;
                // console.log(`Observing: ${this.tileNames[t]}`);
                break;
              }
            }
          }
        }
      }
      // Iterate End

      return true;
    }

    let distribution = new Array<number>(this.actionCount);

    for (let t = 0; t < this.actionCount; t++) {
      distribution[t] = this.waves[selectedX][selectedY][selectedZ][t] ? this.weights[t] : 0;
    }

    let r = weightedRandom(distribution, Math.random());
    for (let t = 0; t < this.actionCount; t++) {
      this.waves[selectedX][selectedY][selectedZ][t] = t == r;
    }

    this.changes[selectedX][selectedY][selectedZ] = true;

    this.observedClone();

    return null;
  }

  propagate() {
    let change = false;
    let canProp;

    // Iterate Start
    for (let x2 = 0; x2 < this.mapX; ++x2) {
      for (let y2 = 0; y2 < this.mapY; ++y2) {
        for (let z2 = 0; z2 < this.mapZ; ++z2) {
          for (let d = 0; d < 6; ++d) {
            // For each Direction in X Y Z Voxel Space
            let x1 = x2;
            let y1 = y2;
            let z1 = z2;

            /*======================================
            =            Periodic Check            =
            ======================================*/
            if (d == 0) {
              if (x2 == 0) {
                if (!this.periodic) {
                  continue;
                }
                else {
                  x1 = this.mapX - 1;
                }
              }
              else {
                x1 = x2 - 1;
              }
            }
            else if (d == 1) {
              if (y2 == this.mapY - 1) {
                if (!this.periodic) {
                  continue;
                }
                else {
                  y1 = 0;
                }
              }
              else {
                y1 = y2 + 1;
              }
            }
            else if (d == 2) {
              if (x2 == this.mapX - 1) {
                if (!this.periodic) {
                  continue;
                }
                else {
                  x1 = 0;
                }
              }
              else {
                x1 = x2 + 1;
              }
            }
            else if (d == 3) {
              if (y2 == 0) {
                if (!this.periodic) {
                  continue;
                }
                else {
                  y1 = this.mapY - 1;
                }
              }
              else {
                y1 = y2 - 1;
              }
            }
            else if (d == 4) {
              if (z2 == this.mapZ - 1) {
                if (!this.periodic) {
                  continue;
                }
                else {
                  z1 = 0;
                }
              }
              else {
                z1 = z2 + 1;
              }
            }
            else {
              if (z2 == 0) {
                if (!this.periodic) {
                  continue;
                }
                else {
                  z1 = this.mapZ - 1;
                }
              }
              else {
                z1 = z2 - 1;
              }
            }
            /*=====  End of Periodic Check  ======*/

            // No Changes this Voxel
            if (!this.changes[x1][y1][z1]) {
              continue;
            }

            // X1 is the Original Voxel
            // X2 is the Neighbor Depending on Direction (0 - 6) and Periodicity

            let wave1 = this.waves[x1][y1][z1];
            let wave2 = this.waves[x2][y2][z2];

            for (let t2 = 0; t2 < this.actionCount; ++t2) {
              if (wave2[t2]) {
                let prop = this.propagator[d][t2];
                canProp = false;

                for (let t1 = 0; t1 < this.actionCount  && !canProp; ++t1) {
                  if (wave1[t1]) {
                    canProp = prop[t1]; // t2 -> t1 Propagate Check
                  }
                }

                if (!canProp) {
                  wave2[t2] = false;
                  this.changes[x2][y2][z2] = true;
                  change = true;
                }
              }
            }
          }
        }
      }
    }
    // Iterate End

    return change;
  }

  run() {
    this.logT = Math.log(this.actionCount);
    this.logProb = new Array<number>();

    for (let t = 0; t < this.actionCount; ++t) {
      let val = Math.log(this.weights[t]);
      this.logProb.push(val);
    }

    this.clear();

    while(true) {
      // console.log(this.textOutput());
      let result = this.observe();

      if (result != null) {
        // Either Sucess or Contradiction
        return result;
      }

      // Some Low Entropy Voxel might have been selected
      // And Changes might have been marked
      while(this.propagate());
    }
  }

  clear() {
    // Iterate Start
    for (let x = 0; x < this.mapX; ++x) {
      for (let y = 0; y < this.mapY; ++y) {
        for (let z = 0; z < this.mapZ; ++z) {
          for (let t = 0; t < this.actionCount; ++t) {
            this.waves[x][y][z][t] = true;
          }

          this.changes[x][y][z] = false;
        }
      }
    }
    // Iterate End

    if (this.ground >= 0) {
      // Iterate Start
      for (let x = 0; x < this.mapX; ++x) {
        for (let y = 0; y < this.mapY; ++y) {
          for (let t = 0; t < this.actionCount; ++t) {
            if (t != this.ground) {
              this.waves[x][y][this.mapZ - 1][t] = false;
            }
          }

          this.changes[x][y][this.mapZ - 1] = true;

          for (let z = 0; z < this.mapZ - 1; ++z) {
            this.waves[x][y][z][this.ground] = false;
            this.changes[x][y][z] = true;
          }
        }
      }
      // Iterate End
    }

    if (this.empty >= 0) {
      for (let x = 0; x < this.mapX; ++x) {
        for (let z = 0; z < this.mapZ; ++z) {
          for (let t = 0; t < this.actionCount; ++t) {
            if (t != this.empty) {
              this.waves[x][0][z][t] = false;
              this.waves[x][this.mapY - 1][z][t] = false;
            }

            this.changes[x][0][z] = true;
            this.changes[x][this.mapY - 1][z] = true;
          }
        }
      }

      for (let y = 0; y < this.mapY; ++y) {
        for (let z = 0; z < this.mapZ; ++z) {
          for (let t = 0; t < this.actionCount; ++t) {
            if (t != this.empty) {
              this.waves[0][y][z][t] = false;
              this.waves[this.mapX - 1][y][z][t] = false;
            }
          }

          this.changes[0][y][z] = true;
          this.changes[this.mapX - 1][y][z] = true;
        }
      }
    }

    // if (this.sky >= 0) {
    //   for (let x = 0; x < this.mapX; ++x) {
    //     for (let y = 0; y < this.mapY; ++y) {
    //       for (let t = 0; t < this.actionCount; ++t) {
    //         if (t != this.sky) {
    //           this.waves[x][y][this.mapZ - 1][t] = false;
    //         }
    //       }

    //       this.changes[x][y][this.mapZ - 1] = true;
    //     }
    //   }
    // }
  }

  textOutput() {
    let result = "";

    // Iterate Start
    for (let z = 0; z < this.mapZ; ++z) {
      for (let y = 0; y < this.mapY; ++y) {
        for (let x = 0; x < this.mapX; ++x) {
          result += `${this.tileNames[this.observed[x][y][z]]}, `;
        }

        result += '\n';
      }

      result += '\n';
    }

    return result;
  }

  transformState(state: any): any {
    let result:any = [];

    if (!state) {
      return result;
    }

    // Iterate Start
    for (let z = 0; z < this.mapZ; ++z) {
      for (let y = 0; y < this.mapY; ++y) {
        for (let x = 0; x < this.mapX; ++x) {
          let observedTiles = state[x][this.mapY - y - 1][this.mapZ - z - 1];

          let validCount = 0;

          for (var t = 0; t < observedTiles.length; ++t) {
            if (!observedTiles[t]) {
              continue;
            }

            ++validCount;
          }

          for (var t = 0; t < observedTiles.length; ++t) {
            if (!observedTiles[t]) {
              continue;
            }

            let transform = this.transforms[t];

            if (!transform) {
              continue;
            }

            let xOffset = t;

            let copy = new TransformVoxel(transform.mesh);
            vec4.copy(copy.rotation, transform.rotation);
            vec3.copy(copy.scale, transform.scale);

            if (validCount > 1) {
              vec3.scale(copy.scale, copy.scale, 0.2);
            } else {
              xOffset = 0;
            }

            copy.position = vec4.fromValues(x * this.voxelSize + xOffset, y * this.voxelSize, z * this.voxelSize, 1);

            result.push(copy);
          }


        }
      }
    }

    return result;
  }

  transformOutput() {
    let result = [];

    // Iterate Start
    for (let z = 0; z < this.mapZ; ++z) {
      for (let y = 0; y < this.mapY; ++y) {
        for (let x = 0; x < this.mapX; ++x) {
          let observedTile = this.observed[x][this.mapY - y - 1][this.mapZ - z - 1];
          let transform = this.transforms[observedTile];

          if (!transform) {
            continue;
          }

          let copy = new TransformVoxel(transform.mesh);
          vec4.copy(copy.rotation, transform.rotation);
          vec3.copy(copy.scale, transform.scale);
          copy.position = vec4.fromValues(x * this.voxelSize, y * this.voxelSize, z * this.voxelSize, 1);

          result.push(copy);
        }
      }
    }

    return result;
  }
};

export default WFC;
