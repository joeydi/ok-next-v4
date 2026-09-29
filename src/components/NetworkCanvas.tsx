"use client";

import { useEffect, useRef } from "react";

// Ported from the old site's /network page: nodes wander around the canvas, wrapping at
// the edges, and any two closer than `maxLength` are joined by a line that fades as they part.
const speed = 0.125;
const minRadius = 2;
const maxRadius = 4;
const maxLength = 120;
const nodeCount = 600;
const offset = 20;

type Scope = paper.PaperScope;

const randomInt = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1) + min);

class Network {
  nodes: NetworkNode[] = [];
  edges: Edge[] = [];
  edgeLayer: paper.Layer;
  nodeLayer: paper.Layer;
  timers: number[] = [];

  constructor(
    public scope: Scope,
    canvas: HTMLCanvasElement,
    public color: string,
  ) {
    scope.setup(canvas);
    this.edgeLayer = new scope.Layer();
    this.nodeLayer = new scope.Layer();

    // Nodes arrive one at a time.
    for (let i = 0; i < nodeCount; i += 1) {
      this.timers.push(window.setTimeout(() => this.addNode(), 100 * i));
    }

    scope.view.onFrame = () => this.draw();
  }

  draw() {
    this.edgeLayer.removeChildren();

    for (const edge of this.edges) edge.update();

    for (const node of this.nodes) {
      node.wander();
      node.update();
      node.checkBounds();
    }
  }

  addNode() {
    const node = new NetworkNode(this);

    // Create edges to every other node
    for (const other of this.nodes) this.edges.push(new Edge(this, node, other));

    this.nodes.push(node);
  }

  destroy() {
    for (const timer of this.timers) clearTimeout(timer);
    this.scope.view.onFrame = null;
    this.scope.project.remove();
  }
}

class Edge {
  constructor(
    public network: Network,
    public start: NetworkNode,
    public end: NetworkNode,
  ) {}

  update() {
    const length = this.start.location.getDistance(this.end.location);

    if (length < maxLength) {
      const { scope, edgeLayer, color } = this.network;
      const line = new scope.Path.Line(this.start.location, this.end.location);
      line.opacity = 1 - length / maxLength;
      line.strokeColor = new scope.Color(color);
      line.strokeWidth = 1;

      edgeLayer.addChild(line);
    }
  }
}

class NetworkNode {
  maxSpeed = Math.random() * speed + speed;
  maxForce = 0.4;
  wanderTheta = 0;
  path: paper.Path;
  location: paper.Point;
  velocity: paper.Point;
  acceleration: paper.Point;

  constructor(public network: Network) {
    const { scope, nodeLayer, color } = network;
    const { width, height } = scope.view.size;

    nodeLayer.activate();

    this.path = new scope.Path.Circle({ center: [0, 0], radius: randomInt(minRadius, maxRadius) });
    this.path.fillColor = new scope.Color(color);
    this.location = new scope.Point(randomInt(-offset, width + offset), randomInt(-offset, height + offset));
    this.velocity = new scope.Point(Math.random() * 10, Math.random() * 10);
    this.acceleration = new scope.Point(Math.random() * 20, Math.random() * 20);
  }

  update() {
    this.velocity = this.velocity.add(this.acceleration);
    this.velocity.length = Math.min(this.maxSpeed, this.velocity.length);

    this.location = this.location.add(this.velocity);

    this.acceleration.length = 0;

    // Change node path position, without this it won't move
    this.path.position = this.location.clone();
  }

  seek(target: paper.Point) {
    let desired = target.subtract(this.location);
    let steer = new this.network.scope.Point(0, 0);

    if (desired.length > 0) {
      desired = desired.normalize(this.maxSpeed);
      steer = desired.subtract(this.velocity);
      steer.length = Math.min(this.maxForce, steer.length);
    }

    this.acceleration = this.acceleration.add(steer);
  }

  wander() {
    const wanderR = 5;
    const wanderD = 100;
    const change = 0.4;

    this.wanderTheta += Math.random() * (change * 2) - change;

    // Aim for a point on a small circle projected ahead of the node.
    const circleLocation = this.velocity.normalize(wanderD).add(this.location);
    const circleOffset = new this.network.scope.Point(
      wanderR * Math.cos(this.wanderTheta),
      wanderR * Math.sin(this.wanderTheta),
    );

    this.seek(circleLocation.add(circleOffset));
  }

  checkBounds() {
    const { width, height } = this.network.scope.view.size;

    if (this.location.x < -offset) this.location.x = width + offset;
    if (this.location.x > width + offset) this.location.x = -offset;
    if (this.location.y < -offset) this.location.y = height + offset;
    if (this.location.y > height + offset) this.location.y = -offset;
  }
}

/** Canvas that fills its positioned parent. Nodes and lines take the canvas's text colour. */
export function NetworkCanvas({ className }: { className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    let network: Network | undefined;
    let cancelled = false;

    // Loaded here so Paper.js stays out of the server render and the initial bundle.
    import("paper/dist/paper-core").then(({ default: core }) => {
      const canvas = canvasRef.current;
      if (cancelled || !canvas) return;
      network = new Network(new core.PaperScope(), canvas, getComputedStyle(canvas).color);
    });

    return () => {
      cancelled = true;
      network?.destroy();
    };
  }, []);

  return <canvas ref={canvasRef} data-paper-resize="true" className={className} />;
}
