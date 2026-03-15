export const formatPrice = (price: number) => {
  return `GH\u20B5${Number(price).toLocaleString("en-GH")}`;
};
