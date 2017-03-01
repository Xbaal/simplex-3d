function Simplex(polyhedron, normals, bounds, optimizationDirection) {
  this.polyhedron = polyhedron;
  this.normals = normals;
  this.bounds = bounds;
  this.direction = optimizationDirection;
  this.statusHistory = [];

  this.step = "basis_initialization";
  this.terminated = false;
}
Object.assign(Simplex.prototype, {
  nextStep: function() {
    if (this.terminated) {
      console.log("the algorithm terminated already");
      return;
    }
    this.statusHistory.push(this.getStatus());
    switch (this.step) {
      case "invalid_basis":
        console.error("a invalid basis was chosen!");
        this.terminated = true;
        break;
      case "optimum_found":
        console.log("The optimal value was found");
        this.terminated = true;
        break;
      case "basis_initialization":
        this.chooseBasis();
        this.step = "improving_edges";
        break;
      case "find_improving_edges":
        this.findImprovingEdges();
        break;
      case "change_basis":
        this.changeBasis();
        break;
      default:

    }
  },
  changeBasis: function() {
    //TODO
  },
  findImprovingEdges: function() {
    //TODO
  },
  chooseBasis: function() {
    //TODO
  },
  getStatus: function() {
    //TODO
  },
  setStatus: function() {
    //TODO
  }
});
