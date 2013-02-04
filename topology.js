"use strict"; "use restrict";

var bits      = require("bit-twiddle")
  , UnionFind = require("union-find");

//Returns the dimension of a cell complex
function dimension(cells) {
  var d = 0;
  for(var i=0; i<cells.length; ++i) {
    d = Math.max(d, cells[i].length);
  }
  return d-1;
}
exports.dimension = dimension;

//Counts the number of vertices in faces
function countVertices(cells) {
  var vc = 0;
  for(var i=0; i<cells.length; ++i) {
    var c = cells[i];
    for(var j=0; j<c.length; ++j) {
      vc = Math.max(vc, c[j]);
    }
  }
  return vc+1;
}
exports.countVertices = countVertices;

//Returns a deep copy of cells
function cloneCells(cells) {
  var ncells = new Array(cells.length);
  for(var i=0; i<cells.length; ++i) {
    ncells[i] = cells[i].slice(0);
  }
  return ncells;
}
exports.cloneCells = cloneCells;

//Ranks a pair of cells up to permutation
function compareCells(a, b) {
  var n = a.length
    , t = a.length - b.length;
  if(t) {
    return t;
  }
  switch(n) {
    case 0:
      return 0;
    case 1:
      return a[0] - b[0];
    case 2:
      var d = a[0]+a[1]-b[0]-b[1];
      if(d) {
        return d;
      }
      return Math.min(a[0],a[1]) - Math.min(b[0],b[1]);
    case 3:
      var l1 = a[0]+a[1]
        , m1 = b[0]+b[1];
      d = l1+a[2] - (m1+b[2]);
      if(d) {
        return d;
      }
      var l0 = Math.min(a[0], a[1])
        , m0 = Math.min(b[0], b[1])
        , d  = Math.min(l0, a[2]) - Math.min(m0, b[2]);
      if(d) {
        return d;
      }
      return Math.min(l0+a[2], l1) - Math.min(m0+b[2], m1);
      
    //TODO: Maybe optimize n=4 as well?
    
    default:
      var as = a.slice(0);
      as.sort();
      var bs = b.slice(0);
      bs.sort();
      for(var i=0; i<n; ++i) {
        t = as[i] - bs[i];
        if(t) {
          return t;
        }
      }
      return 0;
  }
}
exports.compareCells = compareCells;

function compareZipped(a, b) {
  return compareCells(a[0], b[0]);
}

//Puts a cell complex into normal order for the purposes of findCell queries
function normalize(cells, attr) {
  if(attr) {
    var zipped = new Array(cells.length);
    for(var i=0; i<cells.length; ++i) {
      zipped[i] = [cells[i], arr[i]];
    }
    zipped.sort(compareZipped);
    for(var i=0; i<cells.length; ++i) {
      cells[i] = zipped[i][0];
      attr[i] = zipped[i][1];
    }
    return cells
  } else {
    cells.sort(compareCells);
    return cells;
  }
}
exports.normalize = normalize;

//Removes all duplicate cells in the complex
function unique(cells) {
  var ptr = 1;
  for(var i=1; i<cells.length; ++i) {
    var a = cells[i];
    if(compareCells(a, cells[i-1])) {
      if(i === ptr) {
        ptr++;
        continue;
      }
      cells[ptr++] = a;
    }
  }
  cells.length = ptr;
  return cells;
}
exports.unique = unique;

//Finds a cell in a normalized cell complex
function findCell(cells, c) {
  var lo = 0
    , hi = cells.length-1
    , r  = -1;
  while (lo <= hi) {
    var mid = (lo + hi) >> 1
      , s   = compareCells(cells[mid], c);
    if(s <= 0) {
      if(s === 0) {
        r = mid;
      }
      lo = mid + 1;
    } else if(s > 0) {
      hi = mid - 1;
    }
  }
  return r;
}
exports.findCell = findCell;

//Builds an index for an n-cell.  This is more general than dual, but less efficient
function incidence(from_cells, to_cells) {
  var index = new Array(from_cells.length);
  for(var i=0; i<index.length; ++i) {
    index[i] = [];
  }
  var b = [];
  for(var i=0; i<to_cells.length; ++i) {
    var c = to_cells[i];
    for(var k=1; k<(1<<c.length); ++k) {
      b.length = bits.popCount(k);
      var l = 0;
      for(var j=0; j<c.length; ++j) {
        if(k & (1<<j)) {
          b[l++] = c[j];
        }
      }
      var idx=findCell(from_cells, b);
      if(idx < 0) {
        continue;
      }
      while(true) {
        index[idx++].push(i);
        if(idx >= from_cells.length || compareCells(from_cells[idx], b) !== 0) {
          break;
        }
      }
    }
  }
  return index;
}
exports.incidence = incidence;

//Computes the dual of the mesh.  This is basically an optimized version of buildIndex for the situation where from_cells is just the list of vertices
function dual(cells, vertex_count) {
  if(!vertex_count) {
    return incidence(unique(normalize(skeleton(cells, 0))), cells, 0);
  }
  var res = new Array(vertex_count);
  for(var i=0; i<vertex_count; ++i) {
    res[i] = [];
  }
  for(var i=0; i<cells.length; ++i) {
    var c = cells[i];
    for(var j=0; j<c.length; ++j) {
      res[c[j]].push(i);
    }
  }
  return res;
};
exports.dual = dual;

//Enumerates all cells in the complex
function explode(cells) {
  var result = [];
  for(var i=0; i<cells.length; ++i) {
    var c = cells[i];
    for(var j=1; j<1<<c.length; ++j) {
      var b = [];
      for(var k=0; k<c.length; ++k) {
        if(j & (1<<k)) {
          b.push(c[k]);
        }
      }
    }
  }
  return result;
}
exports.explode = explode;

//Enumerates all of the n-cells of a cell complex
function skeleton(cells, n) {
  if(n < 0) {
    return [];
  }
  var result = []
    , k0     = (1<<(n+1))-1;
  for(var i=0; i<cells.length; ++i) {
    var c = cells[i];
    for(var k=k0; k<(1<<c.length); k=bits.nextCombination(k)) {
      var b = new Array(n+1)
        , l = 0;
      for(var j=0; j<c.length; ++j) {
        if(k & (1<<j)) {
          b[l++] = c[j];
        }
      }
      result.push(b);
    }
  }
  return result;
}
exports.skeleton = skeleton;

//Computes the boundary of all cells, does not remove duplicates
function boundary(cells) {
  var res = [];
  for(var i=0; i<cells.length; ++i) {
    var c = cells[i];
    for(var j=0; j<c.length; ++j) {
      var b = new Array(c.length-1);
      for(var k=0, l=0; k<c.length; ++k) {
        if(k !== j) {
          b[l++] = c[k];
        }
      }
      res.push(b);
    }
  }
  return res;
}
exports.boundary = boundary;

//Computes connected components for a dense cell complex
function connectedComponents_dense(cells, vertex_count) {
  var labels = new UnionFind(vertex_count);
  for(var i=0; i<cells.length; ++i) {
    var c = cells[i];
    for(var j=0; j<c.length; ++j) {
      for(var k=j+1; k<c.length; ++k) {
        labels.link(c[j], c[k]);
      }
    }
  }
  var components = []
    , component_labels = labels.ranks;
  for(var i=0; i<component_labels.length; ++i) {
    component_labels[i] = -1;
  }
  for(var i=0; i<cells.length; ++i) {
    var l = labels.find(cells[i][0]);
    if(component_labels[l] < 0) {
      component_labels[l] = components.length;
      components.push([cells[i].slice(0)]);
    } else {
      components[component_labels[l]].push(cells[i].slice(0));
    }
  }
  return components;
}

//Computes connected components for a sparse graph
function connectedComponents_sparse(cells) {
  var vertices  = unique(normalize(skeleton(cells, 0)))
    , labels    = new UnionFind(vertices.length);
  for(var i=0; i<cells.length; ++i) {
    var c = cells[i];
    for(var j=0; j<c.length; ++j) {
      var vj = findCell(vertices, [c[j]]);
      for(var k=j+1; k<c.length; ++k) {
        labels.link(vj, findCell(vertices, [c[k]]));
      }
    }
  }
  var components        = []
    , component_labels  = labels.ranks;
  for(var i=0; i<component_labels.length; ++i) {
    component_labels[i] = -1;
  }
  for(var i=0; i<cells.length; ++i) {
    var l = labels.find(findCell(vertices, [cells[i][0]]));
    if(component_labels[l] < 0) {
      component_labels[l] = components.length;
      components.push([cells[i].slice(0)]);
    } else {
      components[component_labels[l]].push(cells[i].slice(0));
    }
  }
  return components;
}

//Computes connected components for a cell complex
function connectedComponents(cells, vertex_count) {
  if(vertex_count) {
    return connectedComponents_dense(cells, vertex_count);
  }
  return connectedComponents_sparse(cells);
}
exports.connectedComponents = connectedComponents;
