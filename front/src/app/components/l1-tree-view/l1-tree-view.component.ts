import { Component, ChangeDetectionStrategy, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { Select, Store } from '@ngxs/store';
import { CustomSelectors } from '@others/custom-selectors';
import { ApiService } from '@services/api.service';
import { FeaturesState } from '@store/features.state';
import * as d3 from 'd3';
import { debounceTime, Observable } from 'rxjs';

type TreeNode = d3.HierarchyNode<any> & {
  x?: number;
  y?: number;
  x0?: number;
  y0?: number;
  id?: number;
  children?: TreeNode[] | null;
  _children?: TreeNode[] | null;
};

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
    const treeViewElement = d3
      .select<HTMLElement, unknown>('#tree-view')
      .node() as HTMLElement | null;
    if (!treeViewElement) {
      console.warn('Tree view element not found, skipping draw operation');
      return;
    }
    
    const boundries = treeViewElement.getBoundingClientRect();
    // viewer width and height
    const width = boundries.width;
    const height = boundries.height;

    const imageSize = 20;
    const textSpace = 15;

    const margins = { top: 0, right: 120, bottom: 0, left: 30 };
    const dx = 30; // line height
    const dy = width / 4;

    const tree = d3.tree<any>().nodeSize([dx, dy]);
    const diagonal: any = d3
      .linkHorizontal<any, any>()
      .x((d: any) => {
        let appendText = 0;
        if (d.data) {
          appendText = this.widthChecker(d.data.name) + textSpace + 5;
        }
        return d.y + appendText;
      })
      .y((d: any) => d.x + 1);

    let root = d3.hierarchy(this.viewingData as any) as TreeNode;
    (root as TreeNode).x0 = dy / 2;
    (root as TreeNode).y0 = 0;
    (root as TreeNode)
      .descendants()
      .forEach((d: TreeNode, i: number) => {
        (d as any).id = i;
      });

    const zoom = d3
      .zoom<any, any>()
      .scaleExtent([1, 10])
      .on('zoom', (event: any) => {
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

    function centerNode(source: TreeNode) {
      const t = d3.zoomTransform(parent.node() as any);
      const selectedNode = d3
        .selectAll<SVGGraphicsElement, any>('g')
        .filter((d: any) => (d ? d.id === source.id : false))
        .node() as SVGGraphicsElement | null;
      
      // Check if the node exists before calling getBBox
      if (!selectedNode) {
        console.warn('Node not found for centering, skipping center operation');
        return;
      }
      
      const boundries = selectedNode.getBBox();
      let x = -(source as TreeNode).y0!;
      let y = -(source as TreeNode).x0!;
      x = x * t.k + width / 2 - margins.left - boundries.width / 2;
      if ((source as TreeNode).children) {
        x = x - dy / 2;
      }
      y = y * t.k - dx * 2; // move upwards a little bit....
      d3.select('svg')
        .transition()
        .duration(250)
        .call(zoom.transform, d3.zoomIdentity.translate(x, y).scale(t.k));
    }

    const update = (source: TreeNode) => {
      const duration = 250;
      const nodes = (root as TreeNode).descendants().reverse() as TreeNode[];
      const links = (root as TreeNode).links();

      // Compute the new tree layout.
      tree(root);

      let left: TreeNode = root as TreeNode;
      let right: TreeNode = root as TreeNode;
      (root as TreeNode).eachBefore((node: TreeNode) => {
        if ((node.x ?? 0) < (left.x ?? 0)) left = node;
        if ((node.x ?? 0) > (right.x ?? 0)) right = node;
      });

      const height =
        (right.x ?? 0) - (left.x ?? 0) + margins.top + margins.bottom;
      const transition = parent
        .transition()
        .duration(duration)
        .attr(
          'viewBox',
          `${-margins.left} ${(left.x ?? 0) - margins.top} ${width} ${height}`
        )
        .tween(
          'resize',
          window.ResizeObserver ? null : () => () => svg.dispatch('toggle')
        );

      // Update the nodes…
      const node = gNode
        .selectAll<SVGGElement, TreeNode>('g')
        .data(nodes, (d: TreeNode) => d.id);
      let feature: Feature;

      // Enter any new nodes at the parent's previous position.
      const self = this;
      const nodeEnter = node
        .enter()
        .append('g')
        .attr('transform', d => `translate(${source.y0},${source.x0})`)
        .attr('fill-opacity', 0)
        .attr('stroke-opacity', 0)
        .on('click', function(this: SVGGElement) {
          const d = d3.select(this).datum() as TreeNode;
          toggle(d);
          update(d);
          centerNode(d);
        })
        .on('dblclick', function(this: SVGGElement) {
          const d = d3.select(this).datum() as TreeNode;
          if (d.data.type == 'feature') {
            self._router.navigate(['/from/tree-view/', d.data.id]);
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
        .attr('fill', (d: TreeNode) =>
          d.data.type === 'feature' && d.data.depends_on_others
            ? 'gray'
            : 'black'
        )
        .attr('class', (d: TreeNode) =>
          d.data.type != 'feature' && !d.children && !d._children
            ? 'disabled'
            : ''
        )
        .text((d: TreeNode) => {
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
        .attr('class', (d: TreeNode) => `node-text node-text-${d.data.type}`)
        .text((d: TreeNode) => d.data.name);

      nodeEnter
        .append('circle')
        .attr('r', (d: TreeNode) => (d.parent ? 5 : 0))
        .attr('fill', 'gray')
        .attr('transform', `translate(${-textSpace - 5}, 1)`);

      // Transition nodes to their new position.
      const nodeUpdate = node
        .merge(nodeEnter)
        .transition(transition)
        .attr('transform', (d: TreeNode) => `translate(${d.y},${d.x})`)
        .attr('fill-opacity', 1)
        .attr('stroke-opacity', 1);

      // Transition exiting nodes to the parent's new position.
      const nodeExit = node
        .exit()
        .transition(transition)
        .remove()
        .attr('transform', (d: TreeNode) => `translate(${source.y},${source.x})`)
        .attr('fill-opacity', 0)
        .attr('stroke-opacity', 0);

      // Update the links…
      type LinkDatum = d3.HierarchyPointLink<TreeNode>;
      const link = gLink.selectAll<SVGPathElement, LinkDatum>('path').data(links, (d: LinkDatum) => d.target.id);
      // Enter any new links at the parent's previous position.
      const linkEnter = link
        .enter()
        .append('path')
        .attr('d', (_d: LinkDatum) => {
          const o = { x: source.x0, y: source.y0 };
          return diagonal({ source: o, target: o });
        });
      // Transition links to their new position.
      link
        .merge(linkEnter)
        .transition(transition)
        .attr('d', (d: LinkDatum) => {
          const target = {
            x: d.target.x,
            y: d.target.y - 15,
          };
          return diagonal({ source: d.source, target: target });
        });
      // Transition exiting nodes to the parent's new position.
      link
        .exit()
        .transition(transition)
        .remove()
        .attr('d', (_d: LinkDatum) => {
          const o = { x: source.x, y: source.y };
          return diagonal({ source: o, target: o });
        });

      // Stash the old positions for transition.
      root.eachBefore(d => {
        d.x0 = d.x;
        d.y0 = d.y;
      });
    };
    root.children?.forEach(collapse);
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
