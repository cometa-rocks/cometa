/**
 * TEMPORARY TYPE SUPPRESSIONS FOR D3.JS COMPATIBILITY
 * 
 * This component uses D3.js v7 for tree visualization. After upgrading from Angular 15 to Angular 16,
 * we encountered type compatibility issues between the D3.js type definitions (@types/d3 v7) and the 
 * actual runtime behavior of D3.js. The type system is more strict, but the runtime D3.js API works
 * correctly.
 * 
 * The @ts-ignore directives below are temporary workarounds to allow the code to compile while maintaining
 * functionality. These are NOT runtime errors - the code works correctly at runtime, but TypeScript's
 * type checker cannot infer the correct types for some D3.js operations.
 * 
 * TODO: Future fixes should:
 * 1. Add proper type assertions using 'as any' or specific type casting for D3.js nodes and selections
 * 2. Define custom interfaces extending D3.js types to include custom properties (x0, y0, _children, etc.)
 * 3. Use proper generic types when creating D3 hierarchies (e.g., HierarchyNode<TreeNodeData> instead of HierarchyNode<{}>)
 * 4. Consider migrating to more type-safe D3.js usage patterns or updating to D3.js v8 if available
 * 
 * Related issues:
 * - D3.js v7 types are stricter than previous versions
 * - Custom properties added to D3 nodes (x0, y0, _children, id) are not in type definitions
 * - Type inference for D3 selections and transitions needs explicit type parameters
 */

import { Component, ChangeDetectionStrategy, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { Select, Store } from '@ngxs/store';
import { CustomSelectors } from '@others/custom-selectors';
import { ApiService } from '@services/api.service';
import { FeaturesState } from '@store/features.state';
import * as d3 from 'd3';
import { debounceTime, Observable } from 'rxjs';

@Component({
  selector: 'cometa-l1-tree-view',
  templateUrl: './l1-tree-view.component.html',
  styleUrls: ['./l1-tree-view.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
})
export class L1TreeViewComponent implements OnInit {
  data = {};
  viewingData = {};
  @Select(FeaturesState.GetNewSelectionFolders) currentRoute$: Observable<
    ReturnType<typeof FeaturesState.GetNewSelectionFolders>
  >;

  widthChecker(text) {
    const p = document.createElement('p');
    p.style.fontSize = '16px';
    p.style.position = 'absolute';
    p.style.opacity = '0';
    p.innerHTML = text;
    document.body.append(p);
    const textWidth = p.clientWidth;
    document.body.removeChild(p);
    return textWidth;
  }

  constructor(
    private _store: Store,
    private _api: ApiService,
    private _router: Router
  ) {}

  findEmbededObject(data: any, obj: any) {
    // if data type is feature, add feature id as suffix in name
    // if data type is not feature, just truncate name
    if (data.type === 'feature' && !data.name.includes(' - ' + data.id)) {
      data.name = this.truncateString(data.name, 25) + ` - ${data.id}`;
    } else {
      data.name = this.truncateString(data.name, 25);
    }

    let found = null;
    if (data.id == obj.id && data.name == obj.name && data.type == obj.type) {
      found = data;
    }
    if (data.children) {
      data.children.forEach(child => {
        const value = this.findEmbededObject(child, obj);
        if (value) found = value;
      });
    }
    return found;
  }

  truncateString(input: string, maxLength: number): string {
    const ellipsis = '...';

    if (input.length <= maxLength) {
      return input;
    }

    const prefixLength = Math.floor((maxLength - ellipsis.length) / 2);
    const suffixLength = Math.ceil((maxLength - ellipsis.length) / 2);

    const prefix = input.slice(0, prefixLength);
    const suffix = input.slice(-suffixLength);

    return prefix + ellipsis + suffix;
  }

  dataFromCurrentRoute(currentRouteArray) {
    // get the last object from the route
    const elem: Folder = currentRouteArray.slice(-1).pop();
    if (!elem) {
      return this.data;
    }

    const object = {
      id: elem.folder_id,
      name: elem.name,
      type: elem.type == undefined ? 'folder' : elem.type,
    };
    return this.findEmbededObject(this.data, object);
  }

  draw() {
    // Check if the tree-view element exists before proceeding
    // This prevents "Cannot read properties of null (reading 'getBoundingClientRect')" errors
    const treeViewElement = d3.select('#tree-view').node();
    if (!treeViewElement) {
      console.warn('Tree view element not found, skipping draw operation');
      return;
    }
    
    // @ts-ignore - D3.js node() returns BaseType which doesn't have getBoundingClientRect in types, but Element nodes do at runtime
    const boundries = treeViewElement.getBoundingClientRect();
    // viewer width and height
    const width = boundries.width;
    const height = boundries.height;

    const imageSize = 20;
    const textSpace = 15;

    const margins = { top: 0, right: 120, bottom: 0, left: 30 };
    const dx = 30; // line height
    const dy = width / 4;

    const tree = d3.tree().nodeSize([dx, dy]);
    const diagonal = d3
      .linkHorizontal()
      .x(d => {
        let appendText = 0;
        // @ts-ignore - D3.js linkHorizontal callback receives HierarchyNode but types show [number, number]
        if (d.data) appendText = this.widthChecker(d.data.name) + textSpace + 5;
        // @ts-ignore - D3.js HierarchyNode has x/y properties at runtime but types are strict
        return d.y + appendText;
      })
      // @ts-ignore - D3.js HierarchyNode has x/y properties at runtime but types are strict
      .y(d => d.x + 1);

    let root = d3.hierarchy(this.viewingData);
    // @ts-ignore - Custom properties x0/y0 added to D3 nodes are not in type definitions
    root.x0 = dy / 2;
    // @ts-ignore - Custom properties x0/y0 added to D3 nodes are not in type definitions
    root.y0 = 0;
    root.descendants().forEach((d, i) => {
      // @ts-ignore - Custom property 'id' added to D3 nodes is not in type definitions
      d.id = i;
    });

    const zoom = d3
      .zoom()
      .scaleExtent([1, 10])
      .on('zoom', event => {
        svg.attr('transform', event.transform);
      });

    const parent = d3
      .select('#tree-view')
      .append('svg')
      .attr('width', '100%')
      .attr('height', '99%')
      .style('font', '10px sans-serif')
      .style('user-select', 'none')
      .call(zoom)
      .on('dblclick.zoom', null);
    const svg = parent.append('g');

    const gLink = svg
      .append('g')
      .attr('fill', 'none')
      .attr('stroke', '#555')
      .attr('stroke-opacity', 0.4)
      .attr('stroke-width', 1.5);
    const gNode = svg
      .append('g')
      .attr('cursor', 'pointer')
      .attr('pointer-events', 'all');

    const collapse = d => {
      if (d.children) {
        d._children = d.children;
        d._children.forEach(collapse);
        d.children = null;
      }
    };

    const expand = d => {
      if (d._children) {
        d.children = d._children;
        d.children.forEach(expand);
        d._children = null;
      }
    };

    const toggle = d => {
      if (d._children) {
        d.children = d._children;
        d._children = null;
      } else if (d.children) {
        d._children = d.children;
        d.children = null;
      }
    };

    function centerNode(source) {
      const t = d3.zoomTransform(parent.node());
      const selectedNode = d3
        .selectAll('g')
        // @ts-ignore - D3.js selection filter callback type inference issue, 'd' is typed as 'unknown'
        .filter(d => (d ? d.id == source.id : false))
        .node();
      
      // Check if the node exists before calling getBBox
      if (!selectedNode) {
        console.warn('Node not found for centering, skipping center operation');
        return;
      }
      
      // @ts-ignore - D3.js node() returns BaseType which doesn't have getBBox in types, but SVGElement nodes do at runtime
      const boundries = selectedNode.getBBox();
      // @ts-ignore - D3.js custom properties x0/y0 not in type definitions
      let x = -source.y0;
      // @ts-ignore - D3.js custom properties x0/y0 not in type definitions
      let y = -source.x0;
      x = x * t.k + width / 2 - margins.left - boundries.width / 2;
      if (source.children) {
        x = x - dy / 2;
      }
      y = y * t.k - dx * 2; // move upwards a little bit....
      d3.select('svg')
        .transition()
        .duration(250)
        // @ts-ignore - D3.js transition.call() type signature mismatch between Selection and Transition types
        .call(zoom.transform, d3.zoomIdentity.translate(x, y).scale(t.k));
    }

    const update = source => {
      const duration = 250;
      const nodes = root.descendants().reverse();
      const links = root.links();

      // Compute the new tree layout.
      tree(root);

      let left = root;
      let right = root;
      root.eachBefore(node => {
        // @ts-ignore - D3.js HierarchyNode has x/y properties at runtime but types show HierarchyNode<{}>
        if (node.x < left.x) left = node;
        // @ts-ignore - D3.js HierarchyNode has x/y properties at runtime but types show HierarchyNode<{}>
        if (node.x > right.x) right = node;
      });

      // @ts-ignore - D3.js HierarchyNode has x/y properties at runtime but types show HierarchyNode<{}>
      const height = right.x - left.x + margins.top + margins.bottom;
      const transition = parent
        .transition()
        .duration(duration)
        // @ts-ignore - D3.js attr() expects string|number|boolean but viewBox needs array of numbers
        .attr('viewBox', [-margins.left, left.x - margins.top, width, height])
        .tween(
          'resize',
          window.ResizeObserver ? null : () => () => svg.dispatch('toggle')
        );

      // Update the nodes…
      // @ts-ignore - D3.js data() key function type inference issue, 'd' is typed as 'unknown' but has 'id' at runtime
      const node = gNode.selectAll('g').data(nodes, d => d.id);
      let feature: Feature;

      // Enter any new nodes at the parent's previous position.
      const nodeEnter = node
        .enter()
        .append('g')
        // @ts-ignore - D3.js custom properties x0/y0 not in type definitions
        .attr('transform', d => `translate(${source.y0},${source.x0})`)
        .attr('fill-opacity', 0)
        .attr('stroke-opacity', 0)
        .on('click', (event, d) => {
          toggle(d);
          update(d);
          centerNode(d);
        })
        .on('dblclick', (event, d) => {
          // @ts-ignore - D3.js HierarchyNode data property typed as {} but has custom properties at runtime
          if (d.data.type == 'feature') {
            // @ts-ignore - D3.js HierarchyNode data property typed as {} but has custom properties at runtime
            this._router.navigate(['/from/tree-view/', d.data.id]);
          }
        });

      nodeEnter
        .append('text')
        .attr('width', imageSize)
        .attr('height', imageSize)
        .style('font-family', 'Material Icons')
        .style(
          'transform',
          `translate(-${imageSize / 2}px, ${imageSize / 2}px)`
        )
        .attr('font-size', '20px')
        .attr('fill', d =>
          // @ts-ignore - D3.js HierarchyNode data property typed as {} but has custom properties at runtime
          d.data.type === 'feature' && d.data.depends_on_others
            ? 'gray'
            : 'black'
        )
        .attr('class', d =>
          // @ts-ignore - D3.js HierarchyNode data property and _children custom property not in type definitions
          d.data.type != 'feature' && !d.children && !d._children
            ? 'disabled'
            : ''
        )
        .text(d => {
          // @ts-ignore - D3.js HierarchyNode data property typed as {} but has custom properties at runtime
          switch (d.data.type) {
            case 'department':
              return 'domain';
            case 'folder':
              return 'folder icon';
            case 'home':
              return 'home';
            case 'feature':
              return 'description icon';
            case 'variables':
            case 'variable':
              return 'settings_ethernet';
          }
        });

      nodeEnter
        .append('text')
        .attr('dy', '0.40em')
        .attr('x', textSpace)
        .attr('text-anchor', 'start')
        // @ts-ignore - D3.js HierarchyNode data property typed as {} but has custom properties at runtime
        .attr('class', d => `node-text node-text-${d.data.type}`)
        // @ts-ignore - D3.js HierarchyNode data property typed as {} but has custom properties at runtime
        .text(d => d.data.name);

      nodeEnter
        .append('circle')
        .attr('r', d => (d.parent ? 5 : 0))
        .attr('fill', 'gray')
        .attr('transform', `translate(${-textSpace - 5}, 1)`);

      // Transition nodes to their new position.
      const nodeUpdate = node
        .merge(nodeEnter)
        .transition(transition)
        // @ts-ignore - D3.js HierarchyNode has x/y properties at runtime but types show HierarchyNode<{}>
        .attr('transform', d => `translate(${d.y},${d.x})`)
        .attr('fill-opacity', 1)
        .attr('stroke-opacity', 1);

      // Transition exiting nodes to the parent's new position.
      const nodeExit = node
        .exit()
        .transition(transition)
        .remove()
        // @ts-ignore - D3.js HierarchyNode has x/y properties at runtime but types show HierarchyNode<{}>
        .attr('transform', d => `translate(${source.y},${source.x})`)
        .attr('fill-opacity', 0)
        .attr('stroke-opacity', 0);

      // Update the links…
      // @ts-ignore - D3.js link data key function type inference issue, 'd' is typed as 'unknown' but has 'target.id' at runtime
      const link = gLink.selectAll('path').data(links, d => d.target.id);
      // Enter any new links at the parent's previous position.
      const linkEnter = link
        .enter()
        .append('path')
        .attr('d', d => {
          // @ts-ignore - D3.js custom properties x0/y0 not in type definitions, and diagonal expects different types
          const o = { x: source.x0, y: source.y0 };
          // @ts-ignore - D3.js diagonal linkHorizontal type expects [number, number] but accepts objects at runtime
          return diagonal({ source: o, target: o });
        });
      // Transition links to their new position.
      link
        .merge(linkEnter)
        .transition(transition)
        .attr('d', d => {
          // @ts-ignore - D3.js HierarchyNode link has x/y properties at runtime but types expect [number, number]
          const target = {
            x: d.target.x,
            y: d.target.y - 15,
          };
          // @ts-ignore - D3.js diagonal linkHorizontal type expects [number, number] but accepts HierarchyNode at runtime
          return diagonal({ source: d.source, target: target });
        });
      // Transition exiting nodes to the parent's new position.
      link
        .exit()
        .transition(transition)
        .remove()
        .attr('d', d => {
          // @ts-ignore - D3.js HierarchyNode has x/y properties at runtime but types show HierarchyNode<{}>
          const o = { x: source.x, y: source.y };
          // @ts-ignore - D3.js diagonal linkHorizontal type expects [number, number] but accepts objects at runtime
          return diagonal({ source: o, target: o });
        });

      // Stash the old positions for transition.
      root.eachBefore(d => {
        // @ts-ignore - Custom properties x0/y0 and x/y properties not fully typed in D3.js HierarchyNode
        d.x0 = d.x;
        // @ts-ignore - Custom properties x0/y0 and x/y properties not fully typed in D3.js HierarchyNode
        d.y0 = d.y;
      });
    };
    root.children.forEach(collapse);
    update(root);
    centerNode(root);
  }

  async ngOnInit() {
    this.data = await this._api.getTreeView().toPromise();

    this.currentRoute$.pipe(debounceTime(100)).subscribe(d => {
      const data = this.dataFromCurrentRoute(d);
      if (data) {
        this.viewingData = data;
        d3.select('svg').remove();
        
        // Ensure the tree-view element exists before drawing
        setTimeout(() => {
          const treeViewElement = document.getElementById('tree-view');
          if (treeViewElement) {
            this.draw();
          } else {
            console.warn('Tree view element not found, retrying in 100ms');
            setTimeout(() => this.draw(), 100);
          }
        }, 0);
      }
    });
  }
}
