// 同一份公開資料集換幾種政見內容：沒有政見、政見全部集中在第一個議題區、每條政見重複三次。
// 「動態數量固定」與「裝飾數量固定」關卡用它重算配置，換哪一種都必須得到同樣的結果（ADR 0001）。
export function policyVariants(dataset) {
  const firstArea = dataset.issueAreas[0]?.id;
  return [
    { name: '沒有任何政見', policies: [] },
    { name: '政見全部集中在第一個議題區', policies: dataset.policies.map((p) => ({ ...p, issueAreaId: firstArea })) },
    { name: '每條政見重複三次', policies: dataset.policies.flatMap((p) => [0, 1, 2].map((i) => ({ ...p, id: `${p.id}-${i}` }))) },
  ];
}
