function nextStep(status){
  if (!status || !status.statusCode) {
    throw new Error("unknown status!");
  }
}
