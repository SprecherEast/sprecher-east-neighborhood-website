// jsdom doesn't scroll, so it has no scrollIntoView; components call it to bring a message into view.
if (typeof Element !== 'undefined' && !Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = () => {}
}
