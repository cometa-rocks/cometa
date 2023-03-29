import { Component, ChangeDetectionStrategy, Input, OnInit } from '@angular/core';
import * as d3 from 'd3';

@Component({
  selector: 'cometa-l1-tree-view',
  templateUrl: './l1-tree-view.component.html',
  styleUrls: ['./l1-tree-view.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class L1TreeViewComponent implements OnInit{

  @Input() data$: any
  data = {
    "name": "Default",
    "type": "department",
    "children": [
        { "name": "SupperLongFolderName", "type": "folder", "children": [
            { "name": "SupperLongFolderNameTimesTwo", "type": "feature" },
            { "name": "SupperLongFolderNameTimesTwoSupperLongFolderNameTimesTwo", "type": "feature" },
            { "name": "MyTests8", "type": "feature" }, 
            { "name": "MyTests1", "type": "folder", "children": [
                { "name": "MyTests6", "type": "feature" },
                { "name": "MyTests7", "type": "feature" },
                { "name": "MyTests8", "type": "feature" }
            ]},
            { "name": "MyTests1", "type": "folder", "children": [
                { "name": "MyTests6", "type": "feature" },
                { "name": "MyTests7", "type": "feature" },
                { "name": "MyTests8", "type": "feature" }
            ]}  
        ]},
        { "name": "MyTests2", "type": "folder" },
        { "name": "MyTests3", "type": "folder" },
        { "name": "MyTests4", "type": "folder" },
        { "name": "MyTests5", "type": "folder", "children": [
            { "name": "MyTests6", "type": "feature" },
            { "name": "MyTests7", "type": "feature" },
            { "name": "MyTests8", "type": "feature" }
        ]},
        { "name": "MyTests1", "type": "folder", "children": [
            { "name": "MyTests6", "type": "feature" },
            { "name": "MyTests7", "type": "feature" },
            { "name": "MyTests8", "type": "feature" }
        ]},
        { "name": "MyTests6", "type": "folder" },
        { "name": "MyTests7", "type": "folder" },
        { "name": "MyTests8", "type": "folder" },
        { "name": "MyTests6", "type": "feature" },
        { "name": "MyTests7", "type": "feature" },
        { "name": "MyTests8", "type": "feature" }
    ]
  }

  widthChecker(text) {
    const p = document.createElement("p");
    p.style.fontSize = "16px";
    p.style.position = "absolute";
    p.style.opacity = "0";
    p.innerHTML = text;
    document.body.append(p);
    const textWidth = p.clientWidth;
    document.body.removeChild(p);
    return textWidth * 0.65;
}

  constructor( ) {}

  ngOnInit() {
    const boundries = d3.select("#tree-view").node().getBoundingClientRect();
    // viewer width and height
    const width = boundries.width;
    const height = boundries.height;

    const imageSize = 20;
    const textSpace = 15;

    const margins = {top: 10, right: 120, bottom: 10, left: 30};
    const dx = 30; // line height
    const dy = width / 4;

    const tree = d3.tree().nodeSize([dx, dy]);
    const diagonal = d3.linkHorizontal().x(d => {
        let appendText = 0;
        if (d.data) appendText = this.widthChecker(d.data.name) + textSpace + 5
        return d.y + appendText
    }).y(d => d.x + 1);

    const root = d3.hierarchy(this.data);
    root.x0 = dy / 2;
    root.y0 = 0;
    root.descendants().forEach((d, i) => {
        d.id = i;
        d._children = d.children;
        if ( d.depth && d.data.name.length !== 7 ) d.children == null;
    })

    const zoom = d3.zoom().scaleExtent([-5, 5])
                          .on('zoom', (event) => {
                            svg.attr("transform", event.transform)
                          })

    const parent = d3.select("#tree-view").append("svg")
                                  .attr("width", width)
                                  .attr("height", height)
                                  .style("font", "10px sans-serif")
                                  .style("user-select", "none")
                                  .call(zoom);
    const svg = parent.append("g");

    const gLink = svg.append("g")
                    .attr("fill", "none")
                    .attr("stroke", "#555")
                    .attr("stroke-opacity", 0.4)
                    .attr("stroke-width", 1.5);
    const gNode = svg.append("g")
                    .attr("cursor", "pointer")
                    .attr("pointer-events", "all");
    
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

      // Enter any new nodes at the parent's previous position.
      const nodeEnter = node.enter().append("g")
                                    .attr("transform", d => `translate(${source.y0},${source.x0})`)
                                    .attr("fill-opacity", 0)
                                    .attr("stroke-opacity", 0)
                                    .on("click", (event, d) => {
                                      if (d.data.type != "feature") {
                                          d.children = d.children ? null : d._children;
                                          update(d);
                                      }
                                    })
                                    .on("dblclick", (event, d) => {
                                      if (d.data.type == "feature") {
                                          console.log("https://myco.meta.link.com/#/app/env/" + d.data.name)
                                      }
                                    })
  
      nodeEnter.append("image")
                .attr("xlink:href", d => `/assets/icons/${d.data.type}.svg`)
                .attr("width", imageSize)
                .attr("height", imageSize)
                .style("transform", `translate(${-imageSize/2}px, ${-imageSize/2}px)`)
                .attr("class", d => d.data.type != "feature" && !d.children && !d._children ? 'disabled' : '')
      
      nodeEnter.append("text")
                .attr("dy", "0.40em")
                .attr("x", textSpace)
                .attr("text-anchor", "start")
                .attr("class", d => `node-text node-text-${d.data.type}`)
                .text(d => d.data.name)
  
      nodeEnter.append("circle")
                .attr("r", d => d.children ? 5 : 0)
                .attr("fill", "gray")
                .attr("transform", d => `translate(${this.widthChecker(d.data.name) + textSpace + 8}, 1)`)
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
  
    update(root);
  }
}
