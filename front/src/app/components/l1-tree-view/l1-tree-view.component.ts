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
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class L1TreeViewComponent implements OnInit{

  data = {}
  viewingData = {}
  @Select(FeaturesState.GetNewSelectionFolders) currentRoute$: Observable<ReturnType<typeof FeaturesState.GetNewSelectionFolders>>;


  widthChecker(text) {
    const p = document.createElement("p");
    p.style.fontSize = "16px";
    p.style.position = "absolute";
    p.style.opacity = "0";
    p.innerHTML = text;
    document.body.append(p);
    const textWidth = p.clientWidth;
    document.body.removeChild(p);
    return textWidth;
}

  constructor( private _store: Store, private _api: ApiService, private _router: Router ) {}

  findEmbededObject(data: any, obj: any) {
    // if data type is feature, add feature id as suffix in name
    // if data type is not feature, just truncate name
    if (data.type === 'feature' && !data.name.includes(data.id + " - ")) {
      data.name = this.truncateString(data.name, 25) + ` - ${data.id}`;
    } else {
      data.name = this.truncateString(data.name, 25);
    }

    let found = null;
    if ( data.id == obj.id && data.name == obj.name && data.type == obj.type ) {
      found = data;
    }
    if (data.children) {
      data.children.forEach(child => {
        const value = this.findEmbededObject(child, obj)
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
    const elem: Folder = currentRouteArray.slice(-1).pop()
    if (!elem) {
      return this.data;
    }

    const object = {
      id: elem.folder_id,
      name: elem.name,
      type: elem.type == undefined ? 'folder' : elem.type
    }
    return this.findEmbededObject(this.data, object);
  }

  draw() {

    const boundries = d3.select("#tree-view").node().getBoundingClientRect();
    // viewer width and height
    const width = boundries.width;
    const height = boundries.height;

    const imageSize = 20;
    const textSpace = 15;

    const margins = {top: 0, right: 120, bottom: 0, left: 30};
    const dx = 30; // line height
    const dy = width / 4;

    const tree = d3.tree().nodeSize([dx, dy]);
    const diagonal = d3.linkHorizontal().x(d => {
        let appendText = 0;
        if (d.data) appendText = this.widthChecker(d.data.name) + textSpace + 5
        return d.y + appendText
    }).y(d => d.x + 1);

    let root = d3.hierarchy(this.viewingData);
    root.x0 = dy / 2;
    root.y0 = 0;
    root.descendants().forEach((d, i) => {
      d.id = i;
    })

    const zoom = d3.zoom().scaleExtent([1, 10])
                          .on('zoom', (event) => {
                            svg.attr("transform", event.transform)
                          })

    const parent = d3.select("#tree-view").append("svg")
                                  .attr("width", "100%")
                                  .attr("height", "99%")
                                  .style("font", "10px sans-serif")
                                  .style("user-select", "none")
                                  .call(zoom)
                                  .on("dblclick.zoom", null);
    const svg = parent.append("g");

    const gLink = svg.append("g")
                    .attr("fill", "none")
                    .attr("stroke", "#555")
                    .attr("stroke-opacity", 0.4)
                    .attr("stroke-width", 1.5);
    const gNode = svg.append("g")
                    .attr("cursor", "pointer")
                    .attr("pointer-events", "all");
    
    const collapse = (d) => {
      if (d.children) {
        d._children = d.children;
        d._children.forEach(collapse);
        d.children = null;
      }
    }

    const expand = (d) => {
      if (d._children) {
        d.children = d._children;
        d.children.forEach(expand);
        d._children = null;
      }
    }

    const toggle = (d) => {
      if (d._children) {
        d.children = d._children;
        d._children = null;
      } else if (d.children) {
        d._children = d.children;
        d.children = null;
      }
    }

    function centerNode(source) {
      const t = d3.zoomTransform(parent.node());
      const boundries = d3.selectAll('g').filter(d => d ? d.id == source.id : false).node().getBBox();
      let x = -source.y0;
      let y = -source.x0;
      x = x * t.k + (width / 2) - margins.left - (boundries.width / 2);
      if (source.children) {
        x = x - (dy / 2);
      }
      y = y * t.k - (dx * 2); // move upwards a little bit....
      d3.select('svg').transition().duration(250).call( zoom.transform, d3.zoomIdentity.translate(x,y).scale(t.k) );
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
          if (node.x < left.x) left = node;
          if (node.x > right.x) right = node;
      });
  
      const height = right.x - left.x + margins.top + margins.bottom;
      const transition = parent.transition()
                            .duration(duration)
                            .attr("viewBox", [-margins.left, left.x - margins.top, width, height ])
                            .tween("resize", window.ResizeObserver ? null : () => () => svg.dispatch("toggle"));
      
      // Update the nodes…
      const node = gNode.selectAll("g")
                        .data(nodes, d => d.id);
      let feature: Feature

      // Enter any new nodes at the parent's previous position.
      const nodeEnter = node.enter().append("g")
                                    .attr("transform", d => `translate(${source.y0},${source.x0})`)
                                    .attr("fill-opacity", 0)
                                    .attr("stroke-opacity", 0)
                                    .on("click", (event, d) => {
                                      toggle(d);
                                      update(d);
                                      centerNode(d)
                                    })
                                    .on("dblclick", (event, d) => {

                                      if (d.data.type == "feature") {
                                        this._router.navigate(['/from/tree-view/', d.data.id])
                                      }
                                    })

      nodeEnter.append("text")
                .attr("width", imageSize)
                .attr("height", imageSize)
                .style("font-family", 'Material Icons')
                .style("transform", `translate(-${imageSize/2}px, ${imageSize/2}px)`)
                .attr('font-size', "20px")
                .attr('fill', d =>  d.data.type === "feature" && d.data.depends_on_others ? 'gray' : 'black')
                .attr("class", d => d.data.type != "feature" && !d.children && !d._children ? 'disabled' : '')
                .text(d => {
                  switch (d.data.type) {
                    case "department":
                      return "domain";
                    case "folder":
                      return "folder icon";
                    case "home":
                      return "home";
                    case "feature":
                      return "description icon";
                    case "variables":
                    case "variable":
                      return "settings_ethernet";
                  }
                })
      
      nodeEnter.append("text")
                .attr("dy", "0.40em")
                .attr("x", textSpace)
                .attr("text-anchor", "start")
                .attr("class", d => `node-text node-text-${d.data.type}`)
                .text(d => d.data.name)
  
      nodeEnter.append("circle")
                .attr("r", d => d.parent ? 5 : 0)
                .attr("fill", "gray")
                .attr("transform", `translate(${-textSpace - 5}, 1)`)
  
      // Transition nodes to their new position.
      const nodeUpdate = node.merge(nodeEnter).transition(transition)
                              .attr("transform", d => `translate(${d.y},${d.x})`)
                              .attr("fill-opacity", 1)
                              .attr("stroke-opacity", 1);
  
      // Transition exiting nodes to the parent's new position.
      const nodeExit = node.exit().transition(transition).remove()
                            .attr("transform", d => `translate(${source.y},${source.x})`)
                            .attr("fill-opacity", 0)
                            .attr("stroke-opacity", 0);
      
      // Update the links…
      const link = gLink.selectAll("path")
                        .data(links, d => d.target.id);
      // Enter any new links at the parent's previous position.
      const linkEnter = link.enter().append("path")
                            .attr("d", d => {
                              const o = {x: source.x0, y: source.y0};
                              return diagonal({source: o, target: o});
                            });
      // Transition links to their new position.
      link.merge(linkEnter).transition(transition)
          .attr("d", d => {
              const target = {
                  x: d.target.x,
                  y: d.target.y - 15
              }
              return diagonal({source: d.source, target: target})
          });
      // Transition exiting nodes to the parent's new position.
      link.exit().transition(transition).remove()
          .attr("d", d => {
            const o = {x: source.x, y: source.y};
            return diagonal({source: o, target: o});
          });
      
      // Stash the old positions for transition.
      root.eachBefore(d => {
          d.x0 = d.x;
          d.y0 = d.y;
      });
      
    }
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
        d3.select("svg").remove();
        this.draw();
      }
    })
  }
}
