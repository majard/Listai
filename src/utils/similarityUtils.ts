import { Product } from "../database/database";

export function findSimilarProducts(name: string, products: Product[], similarityThreshold: number = 0.8): Product[] {
  const preprocessName = (text: string) => {
    return text
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]/g, "");
  };

  const calculateSimilarity = (str1: string, str2: string): number => {
    const processedStr1 = preprocessName(str1);
    const processedStr2 = preprocessName(str2);

    if (processedStr1 === processedStr2) return 1;

    const longer = processedStr1.length > processedStr2.length ? processedStr1 : processedStr2;
    const shorter = processedStr1.length > processedStr2.length ? processedStr2 : processedStr1;

    if (longer.length === 0) return 1.0;

    const costs = new Array<number>();
    for (let i = 0; i <= shorter.length; i++) {
      let lastValue = i;
      for (let j = 0; j <= longer.length; j++) {
        if (i === 0) {
          costs[j] = j;
        } else {
          if (j > 0) {
            let newValue = costs[j - 1];
            if (shorter.charAt(i - 1) !== longer.charAt(j - 1)) {
              newValue = Math.min(Math.min(newValue, lastValue), costs[j]) + 1;
            }
            costs[j - 1] = lastValue;
            lastValue = newValue;
          }
        }
      }
      if (i > 0) {
        costs[longer.length] = lastValue;
      }
    }

    return (longer.length - costs[longer.length]) / longer.length;
  };

  const processedTargetName = preprocessName(name);
  return products
    .map(product => ({
      product,
      similarity: calculateSimilarity(processedTargetName, product.name)
    }))
    .filter(item => item.similarity >= similarityThreshold)
    .sort((a, b) => b.similarity - a.similarity)
    .map(item => item.product);
}
