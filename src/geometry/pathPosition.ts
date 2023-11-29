import { Point } from './point.ts';
import { postcondition, VerifyNotReached } from '../utils/assert.ts';
import { Path } from './path.ts';

export class PathPosition {
  private _globalT: number | undefined;
  private _globalD: number | undefined;
  private _point: Point | undefined;
  private _segmentIndex: number | undefined;
  private _localT: number | undefined;
  private _localD: number | undefined;
  private _path: Path | undefined;

  set path(p: Path) {
    this._path = p;

    // Check we have all we need
    postcondition.is.true(
      this._point !== undefined ||
        (this._segmentIndex !== undefined && this._localT !== undefined) ||
        (this._segmentIndex !== undefined && this._localD !== undefined) ||
        this._globalD !== undefined ||
        this._globalT !== undefined
    );
  }

  set globalT(t: number) {
    this._globalT = t;
  }

  set globalD(d: number) {
    this._globalD = d;
  }

  set point(p: Point) {
    this._point = p;
  }

  set segmentIndex(i: number) {
    this._segmentIndex = i;
  }

  set localT(t: number) {
    this._localT = t;
  }

  set localD(d: number) {
    this._localD = d;
  }

  get globalT() {
    if (this._globalT !== undefined) return this._globalT;

    if (this._globalD !== undefined) {
      this.fetchGlobalTFromGlobalD(this._globalD);
    } else if (this._localT !== undefined && this._segmentIndex !== undefined) {
      this.fetchGlobalTFromLocalT(this._localT, this._segmentIndex);
    } else if (this._localD !== undefined && this._segmentIndex !== undefined) {
      this.fetchGlobalTFromLocalD(this._localD, this._segmentIndex);
    } else if (this._point !== undefined) {
      this.fetchFromPoint(this._point);
    } else {
      throw new VerifyNotReached();
    }

    return this._globalT!;
  }

  get globalD() {
    if (this._globalD !== undefined) return this._globalD;

    if (this._localD !== undefined && this._segmentIndex !== undefined) {
      this.fetchGlobalDFromLocalD(this._localD, this._segmentIndex);
    } else if (this._globalT !== undefined) {
      this.fetchGlobalDFromGlobalT(this._globalT);
    } else if (this._localT !== undefined && this._segmentIndex !== undefined) {
      this.fetchLocalDFromLocalT(this._localT, this._segmentIndex);
      this.fetchGlobalDFromLocalD(this._localD!, this._segmentIndex);
    } else if (this._point !== undefined) {
      this.fetchFromPoint(this._point);
      this.fetchGlobalDFromGlobalT(this._globalT!);
    } else {
      throw new VerifyNotReached();
    }

    return this._globalD!;
  }

  get point() {
    if (this._point !== undefined) return this._point;

    if (this._localT !== undefined && this._segmentIndex !== undefined) {
      this.fetchPointFromLocalT(this._localT, this._segmentIndex);
    } else if (this._localD !== undefined && this._segmentIndex !== undefined) {
      this.fetchLocalTFromLocalD(this._localD, this._segmentIndex);
      this.fetchPointFromLocalT(this._localD!, this._segmentIndex);
    } else if (this._globalD !== undefined) {
      this.fetchPointFromGlobalD(this._globalD);
    } else if (this._globalT !== undefined) {
      this.fetchGlobalDFromGlobalT(this._globalT);
      this.fetchPointFromGlobalD(this._globalD!);
    } else {
      throw new VerifyNotReached();
    }

    return this._point!;
  }

  get segmentIndex() {
    if (this._segmentIndex !== undefined) return this._segmentIndex;

    if (this._point !== undefined) {
      this.fetchFromPoint(this._point);
    } else if (this._globalD !== undefined) {
      this.fetchLocalTFromGlobalD(this._globalD);
    } else if (this._globalT !== undefined) {
      this.fetchGlobalDFromGlobalT(this._globalT);
      this.fetchLocalTFromGlobalD(this._globalD!);
    } else {
      throw new VerifyNotReached();
    }

    return this._segmentIndex!;
  }

  get localT() {
    if (this._localT !== undefined) return this._localT;

    if (this._localD !== undefined && this._segmentIndex !== undefined) {
      this.fetchLocalTFromLocalD(this._localD, this._segmentIndex);
    } else if (this._globalD !== undefined) {
      this.fetchLocalTFromGlobalD(this._globalD);
    } else if (this._globalT !== undefined) {
      this.fetchGlobalDFromGlobalT(this._globalT);
      this.fetchLocalTFromGlobalD(this._globalD!);
    } else if (this._point !== undefined) {
      this.fetchFromPoint(this._point);
    } else {
      throw new VerifyNotReached();
    }
    return this._localT!;
  }

  get localD() {
    if (this._localD !== undefined) return this._localD;

    if (this._localT !== undefined && this._segmentIndex !== undefined) {
      this.fetchLocalDFromLocalT(this._localT, this._segmentIndex);
    } else if (this._globalD !== undefined) {
      this.fetchLocalTFromGlobalD(this._globalD);
      this.fetchLocalDFromLocalT(this._localT!, this._segmentIndex!);
    } else if (this._globalT !== undefined) {
      this.fetchGlobalDFromGlobalT(this._globalT);
      this.fetchLocalTFromGlobalD(this._globalD!);
      this.fetchLocalDFromLocalT(this._localT!, this._segmentIndex!);
    } else if (this._point !== undefined) {
      this.fetchFromPoint(this._point);
      this.fetchLocalDFromLocalT(this._localT!, this._segmentIndex!);
    } else {
      throw new VerifyNotReached();
    }

    return this._localD!;
  }

  private fetchGlobalDFromGlobalT(globalT: number) {
    this._globalD ??= globalT * this._path!.length();
  }

  private fetchFromPoint(p: Point) {
    const pp = this._path!.projectPoint(p);
    this._segmentIndex ??= pp.segmentIndex;
    this._localT ??= pp.localT;
    this._globalT ??= pp.globalT;
  }

  private fetchPointFromLocalT(localT: number, segmentIndex: number) {
    this._point ??= this._path!.segments[segmentIndex]!.point(localT);
  }

  private fetchLocalDFromLocalT(localT: number, segmentIndex: number) {
    this.localD ??= localT * this._path!.segments.at(segmentIndex)!.length();
  }

  private fetchGlobalTFromLocalT(localT: number, segmentIndex: number) {
    const lb = this._path!.lengthTo(segmentIndex);
    const segment = this._path!.segments.at(segmentIndex);
    const lengthOfCurrentSegment = segment!.length();

    this._localD ??= localT * lengthOfCurrentSegment;
    this._globalD ??= lb + this._localD;
    this._globalT ??= this._globalD / this._path!.length();
  }

  private fetchLocalTFromLocalD(localD: number, segmentIndex: number) {
    this._localT ??= localD / this._path!.segments[segmentIndex]!.length();
  }

  private fetchGlobalDFromLocalD(localD: number, segmentIndex: number) {
    const lb = this._path!.lengthTo(segmentIndex);
    this._globalD = lb + localD;
  }

  private fetchGlobalTFromLocalD(localD: number, segmentIndex: number) {
    const lb = this._path!.lengthTo(segmentIndex);
    this._globalD ??= lb + localD;
    this._localT ??= localD / this._path!.segments.at(segmentIndex)!.length();
    this._globalT ??= this._globalD / this._path!.length();
  }

  private fetchPointFromGlobalD(globalD: number) {
    this.point ??= this._path!.pointAtLength(globalD);
  }

  private fetchGlobalTFromGlobalD(globalD: number) {
    this._globalT ??= globalD / this._path!.length();
  }

  private fetchLocalTFromGlobalD(globalD: number) {
    let idx = 0;
    let len = 0;
    while (len < globalD) {
      len += this._path!.segments[idx]!.length();
      idx++;
    }

    this._segmentIndex ??= idx;
    this._localT ??= (len - globalD) / this._path!.segments[idx]!.length();
    this._localD ??= len - globalD;
  }
}
