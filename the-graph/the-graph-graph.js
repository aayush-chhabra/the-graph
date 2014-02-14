(function (context) {
  "use strict";

  var TheGraph = context.TheGraph;


  // Graph view

  TheGraph.Graph = React.createClass({
    mixins: [TheGraph.mixins.FakeMouse],
    getInitialState: function() {
      return {
        graph: this.props.graph,
        edgePreview: null,
        edgePreviewX: 0,
        edgePreviewY: 0
      };
    },
    componentDidMount: function () {
      // Listen to noflo graph object's events
      this.props.graph.on("addNode", this.markDirty);
      this.props.graph.on("renameNode", this.markDirty);
      this.props.graph.on("removeNode", this.markDirty);
      this.props.graph.on("changeNode", this.markDirty);
      this.props.graph.on("addEdge", this.markDirty);
      this.props.graph.on("removeEdge", this.markDirty);
      this.props.graph.on("changeEdge", this.markDirty);

      // this.getDOMNode().addEventListener("the-graph-node-move", this.markDirty);
      this.getDOMNode().addEventListener("the-graph-group-move", this.moveGroup);
      this.getDOMNode().addEventListener("the-graph-node-remove", this.removeNode);
    },
    edgePreview: null,
    edgeStart: function (event) {
      // Forwarded from App.edgeStart()

      // Port that triggered this
      var port = {
        node: event.detail.process,
        port: event.detail.port
      };

      // Complete edge if this is the second tap and ports are compatible
      if (this.state.edgePreview && this.state.edgePreview.isIn !== event.detail.isIn) {
        // TODO also check compatible types
        var halfEdge = this.state.edgePreview;
        if (event.detail.isIn) {
          halfEdge.to = port;
        } else {
          halfEdge.from = port;
        }
        this.addEdge(halfEdge);
        this.cancelPreviewEdge();
        return;
      }

      var edge;
      if (event.detail.isIn) {
        edge = { to: port };
      } else {
        edge = { from: port };
      }
      edge.isIn = event.detail.isIn;
      edge.metadata = { route: event.detail.route };
      this.props.app.getDOMNode().addEventListener("pointermove", this.renderPreviewEdge);
      // TODO tap to add new node here
      this.props.app.getDOMNode().addEventListener("tap", this.cancelPreviewEdge);

      this.setState({edgePreview: edge});
    },
    cancelPreviewEdge: function (event) {
      this.props.app.getDOMNode().removeEventListener("pointermove", this.renderPreviewEdge);
      this.props.app.getDOMNode().removeEventListener("tap", this.cancelPreviewEdge);
      this.setState({edgePreview: null});
      this.markDirty();
    },
    renderPreviewEdge: function (event) {
      var scale = this.props.app.state.scale;
      this.setState({
        edgePreviewX: (event.clientX - this.props.app.state.x) / scale,
        edgePreviewY: (event.clientY - this.props.app.state.y) / scale
      });
      this.markDirty();
    },
    addEdge: function (edge) {
      this.state.graph.addEdge(edge.from.node, edge.from.port, edge.to.node, edge.to.port, edge.metadata);
    },
    // triggerFit: function () {
    //   // Zoom to fit
    //   var fit = TheGraph.findFit(this.state.graph);
    //   var fitEvent = new CustomEvent('the-graph-fit', { 
    //     detail: fit, 
    //     bubbles: true
    //   });
    //   this.getDOMNode().dispatchEvent(fitEvent);
    // },
    moveGroup: function (event) {
      var graph = this.state.graph;
      var nodes = event.detail.nodes;

      // Move each group member
      var len = nodes.length;
      for (var i=0; i<len; i++) {
        var node = graph.getNode(nodes[i]);
        if (node) {
          graph.setNodeMetadata(node.id, {
            x: node.metadata.x + event.detail.x,
            y: node.metadata.y + event.detail.y
          });
        }
      }
    },
    listenComponentChanges: function (componentName) {
      var componentEl = document.querySelector("the-component[name='"+componentName+"']");
      // Listen for component changes
      if (componentEl) {
        // Info/library object is already updated from out there
        componentEl.addEventListener('icon', this.markDirty);
        
        // var self = this;
        // TODO update related portInfo.inports
        // componentEl.addEventListener('inports', function (event) {
        //   self.markDirty();
        // });
        // TODO update related portInfo.outports
        // componentEl.addEventListener('outports', function (event) {
        //   self.markDirty();
        // });
      }
    },
    componentInfo: {},
    getComponentInfo: function (componentName) {
      var component = this.componentInfo[componentName];
      if (!component && this.props.library) {
        component = this.props.library[componentName];
        if (component) {
          this.componentInfo[componentName] = component;
          // Only attach this once
          this.listenComponentChanges(componentName);
        }
      }
      return component;
    },
    portInfo: {},
    getPorts: function (processName, componentName) {
      var ports = this.portInfo[processName];
      if (!ports) {
        var inports = {};
        var outports = {};
        if (componentName && this.props.library) {
          // Copy ports from library object
          var component = this.getComponentInfo(componentName);
          var i, port;
          for (i=0; i<component.outports.length; i++) {
            port = component.outports[i];
            if (!port.name) { continue; }
            outports[port.name] = {
              label: port.name,
              type: port.type,
              x: TheGraph.nodeSize,
              y: TheGraph.nodeSize/2
            };
          }
          for (i=0; i<component.inports.length; i++) {
            port = component.inports[i];
            if (!port.name) { continue; }
            inports[port.name] = {
              label: port.name,
              type: port.type,
              x: 0,
              y: TheGraph.nodeSize/2
            };
          }
        }
        ports = {
          inports: inports,
          outports: outports
        };
        this.portInfo[processName] = ports;
      }
      return ports;
    },
    getOutport: function (processName, portName, route, componentName) {
      var ports = this.getPorts(processName, componentName);
      if ( !ports.outports[portName] ) {
        ports.outports[portName] = {
          label: portName,
          x: TheGraph.nodeSize,
          y: TheGraph.nodeSize/2
        };
        this.dirty = true;
      }
      var port = ports.outports[portName];
      // Port will have top edge's color
      if (route !== undefined) {
        port.route = route;
      }
      return port;
    },
    getInport: function (processName, portName, route, componentName) {
      var ports = this.getPorts(processName, componentName);
      if ( !ports.inports[portName] ) {
        ports.inports[portName] = {
          label: portName,
          x: 0,
          y: TheGraph.nodeSize/2
        };
        this.dirty = true;
      }
      var port = ports.inports[portName];
      // Port will have top edge's color
      if (route !== undefined) {
        port.route = route;
      }
      return port;
    },
    removeNode: function (event) {
      var removeKey = event.detail;
      this.graph.removeNode( removeKey );
    },
    dirty: false,
    markDirty: function (event) {
      window.requestAnimationFrame(this.triggerRender);
    },
    triggerRender: function (time) {
      if (this.dirty) {
        return;
      }
      this.dirty = true;
      this.setState({
        graph: this.state.graph
      });
    },
    shouldComponentUpdate: function () {
      // If ports change or nodes move, then edges need to rerender, so we do the whole graph
      return this.dirty;
    },
    render: function() {
      this.dirty = false;

      var self = this;
      var graph = this.state.graph;
      var library = this.props.library;

      // Nodes
      var nodes = graph.nodes.map(function (node) {
        var key = node.id;
        if (!node.metadata) {
          node.metadata = {};
        }
        if (node.metadata.x === undefined) { node.metadata.x = 0; }
        if (node.metadata.y === undefined) { node.metadata.y = 0; }
        if (!node.metadata.label || node.metadata.label === "") {
          node.metadata.label = key;
        }
        var componentInfo = self.getComponentInfo(node.component);
        var icon = (componentInfo && componentInfo.icon ? componentInfo.icon : "cog");
        return TheGraph.Node({
          key: key,
          x: node.metadata.x,
          y: node.metadata.y,
          label: node.metadata.label,
          sublabel: node.component,
          app: self.props.app,
          graphView: self,
          graph: graph,
          node: node,
          icon: icon,
          ports: self.getPorts(key, node.component)
        });
      });

      // Edges
      var edges = graph.edges.map(function (edge) {
        var source = graph.getNode(edge.from.node);
        var target = graph.getNode(edge.to.node);
        if (!source || !target) {
          return;
        }

        var route = 0;
        if (edge.metadata && edge.metadata.route !== undefined) {
          route = edge.metadata.route;
        }

        // Initial ports from edges, and give port top/last edge color
        var sourcePort = self.getOutport(edge.from.node, edge.from.port, route, source.component);
        var targetPort = self.getInport(edge.to.node, edge.to.port, route, target.component);

        // Label
        var label = source.metadata.label + " " + edge.from.port.toUpperCase() + " -> " + 
          edge.to.port.toUpperCase() + " " + target.metadata.label;
        var key = edge.from.node + "() " + edge.from.port.toUpperCase() + " -> " + 
          edge.to.port.toUpperCase() + " " + edge.to.node + "()";

        return TheGraph.Edge({
          key: key,
          graph: graph,
          edge: edge,
          sX: source.metadata.x + TheGraph.nodeSize,
          sY: source.metadata.y + sourcePort.y,
          tX: target.metadata.x,
          tY: target.metadata.y + targetPort.y,
          label: label,
          route: route
        });
      });

      // Exports
      var exports = graph.exports.map(function (exp) {
        // Makes a node with export prop and an edge
        var split = exp.private.split(".");
        var nodeKey = split[0];
        var portKey = split[1];
        var label = exp.public;
        var metadata = exp.metadata;
        if (!metadata) { metadata = exp.metadata = {x:0, y:0}; }
        if (!metadata.x) { metadata.x = 0; }
        if (!metadata.y) { metadata.y = 0; }
        // Figure out if this is an in or out export 
        // Ambuguity due to https://github.com/noflo/noflo/issues/118
        var capsNodeKey = nodeKey;
        var portInfo = self.portInfo[nodeKey];
        if (!portInfo) {
          // WTF lowercased key https://github.com/noflo/noflo/issues/140
          var keys = Object.keys(self.portInfo);
          for (var i=0; i<keys.length; i++) {
            var key = keys[i];
            if (key.toLowerCase() === nodeKey) {
              portInfo = self.portInfo[key];
              capsNodeKey = key;
              break;
            }
          }
        }
        if (!portInfo) {
          console.warn("Didn't find node "+ nodeKey);
          return;
        }
        var inport = portInfo.inports[portKey];
        var outport = portInfo.outports[portKey];
        if (inport && outport) { 
          console.warn("In/out ambiguity for "+exp.private+", going with in. https://github.com/noflo/noflo/issues/118");
        }
        // Actual graph node
        var privateNode = graph.getNode(capsNodeKey);
        if (!privateNode) {
          console.warn("Didn't find node "+ capsNodeKey);
          return;
        }
        // Node view
        var expNode = {
          key: "export.node."+exp.private,
          export: exp,
          x: metadata.x,
          y: metadata.y,
          label: label,
          app: self.props.app,
          graphView: self,
          graph: graph,
          node: {},
          ports: {inports:{}, outports:{}}
        };
        // Edge view
        var expEdge = {
          key: "export.edge."+exp.private,
          export: exp,
          graph: graph,
          edge: {},
          route: (exp.metadata.route ? exp.metadata.route : 0)
        };
        if (inport) {
          // Edge view
          expEdge.label = "export in " + exp.public.toUpperCase() + " -> " + portKey.toUpperCase() + " " + privateNode.metadata.label;
          expEdge.sX = expNode.x + TheGraph.nodeSize;
          expEdge.sY = expNode.y + TheGraph.nodeSize/2;
          expEdge.tX = privateNode.metadata.x + inport.x;
          expEdge.tY = privateNode.metadata.y + inport.y;
          edges.push(TheGraph.Edge(expEdge));
          // Node view
          expNode.isIn = true;
          expNode.ports.outports[label] = {
            label: label,
            type: "all",
            x: TheGraph.nodeSize,
            y: TheGraph.nodeSize/2
          };
          expNode.icon = "sign-in";
          return TheGraph.Node(expNode);
        }
        if (outport) {
          // Edge view
          expEdge.label = privateNode.metadata.label + " " + portKey.toUpperCase() + " -> " + exp.public.toUpperCase() + " export out";
          expEdge.sX = privateNode.metadata.x + outport.x;
          expEdge.sY = privateNode.metadata.y + outport.y;
          expEdge.tX = expNode.x;
          expEdge.tY = expNode.y + TheGraph.nodeSize/2;
          edges.push(TheGraph.Edge(expEdge));
          // Node view
          expNode.isIn = false;
          expNode.ports.inports[label] = {
            label: label,
            type: "all",
            x: 0,
            y: TheGraph.nodeSize/2
          };
          expNode.icon = "sign-out";
          return TheGraph.Node(expNode);
        }
        // Else no private port found
        console.warn("Didn't find private port "+exp.private);
        return;
      });

      // Groups
      var groups = graph.groups.map(function (group) {
        if (group.nodes.length < 1) {
          return;
        }
        var limits = TheGraph.findMinMax(graph, group.nodes);
        if (!limits) {
          return;
        }
        var g = TheGraph.Group({
          key: "group."+group.name,
          minX: limits.minX,
          minY: limits.minY,
          maxX: limits.maxX,
          maxY: limits.maxY,
          scale: self.props.scale,
          label: group.name,
          nodes: group.nodes,
          description: group.metadata.description
        });
        return g;
      });

      // Edge preview
      var edgePreview = this.state.edgePreview;
      if (edgePreview) {
        var edgePreviewView;
        if (edgePreview.from) {
          var source = graph.getNode(edgePreview.from.node);
          var sourcePort = this.getOutport(edgePreview.from.node, edgePreview.from.port);
          edgePreviewView = TheGraph.Edge({
            key: "edge-preview",
            sX: source.metadata.x + TheGraph.nodeSize,
            sY: source.metadata.y + sourcePort.y,
            tX: this.state.edgePreviewX,
            tY: this.state.edgePreviewY,
            label: "",
            route: edgePreview.metadata.route
          });
        } else {
          var target = graph.getNode(edgePreview.to.node);
          var targetPort = this.getInport(edgePreview.to.node, edgePreview.to.port);
          edgePreviewView = TheGraph.Edge({
            key: "edge-preview",
            sX: this.state.edgePreviewX,
            sY: this.state.edgePreviewY,
            tX: target.metadata.x,
            tY: target.metadata.y + targetPort.y,
            label: "",
            route: edgePreview.metadata.route
          });
        }
        edges.push(edgePreviewView);
      }

      return React.DOM.g(
        {
          className: "graph"//,
          // onMouseDown: this.onMouseDown
        },
        React.DOM.g({
          className: "groups",
          children: groups
        }),
        React.DOM.g({
          className: "edges",
          children: edges
        }),
        React.DOM.g({
          className: "nodes", 
          children: nodes
        }),
        React.DOM.g({
          className: "exports", 
          children: exports
        })
      );
    }
  });  

})(this);