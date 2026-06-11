// Minimal declaration for the legacy `react-graph-vis` package which ships
// without TypeScript types. We model only the bits we actually use so
// `graph.tsx` can drop its `@ts-ignore`. A full replacement of the package
// is tracked separately — keep this surface small.
declare module 'react-graph-vis' {
  import * as React from 'react';

  // vis-network nodes/edges are loosely shaped — many optional fields are
  // accepted (color, font, image, shape, etc.). Keep this declaration permissive
  // so consumer-side shapes (e.g. `{id, label, shape, image}`) assign cleanly.
  export type VisNetworkNode = Record<string, unknown> & {
    id?: string | number;
    label?: string;
    shape?: string;
    image?: string;
  };

  export type VisNetworkEdge = Record<string, unknown> & {
    id?: string | number;
    from: string | number;
    to: string | number;
    label?: string;
  };

  export interface VisNetworkGraph {
    nodes: VisNetworkNode[];
    edges: VisNetworkEdge[];
  }

  // The underlying vis-network `Network` instance. Methods we touch are typed
  // explicitly; everything else is left as `unknown` to discourage casual use.
  export interface VisNetwork {
    on(event: string, handler: (params: any) => void): void;
    off(event: string, handler?: (params: any) => void): void;
    getSelectedNodes(): Array<string | number>;
    unselectAll(): void;
  }

  export interface GraphProps {
    graph: {nodes: VisNetworkNode[] | any[]; edges: VisNetworkEdge[] | any[]};
    options?: Record<string, unknown>;
    events?: Record<string, (params: any) => void>;
    getNetwork?: (network: VisNetwork) => void;
    getNodes?: (nodes: Record<string | number, VisNetworkNode>) => void;
    getEdges?: (edges: Record<string | number, VisNetworkEdge>) => void;
    style?: React.CSSProperties;
    identifier?: string;
  }

  const Graph: React.ComponentType<GraphProps>;
  export default Graph;
}
