export function getPageConfig() {
  var page = document.querySelector(".page");
  return {
    listSrc: page ? page.dataset.recordsSrc : "data/lista.json",
    detailTemplate: page ? page.dataset.detailTemplate : "persona.html"
  };
}
