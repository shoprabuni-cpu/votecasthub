export type MenuItem = { id: string; name: string };
export function menuSelection(items: MenuItem[], tokens: string[], cursor: number) {
 let page=0;
 while(cursor<tokens.length && ['8','9'].includes(tokens[cursor])) { if(tokens[cursor]==='9' && (page+1)*4<items.length)page++;else if(tokens[cursor]==='8' && page>0)page--;else return {error:true,cursor};cursor++; }
 const visible=items.slice(page*4,page*4+4);
 if(cursor===tokens.length)return {cursor,prompt:visible.map((item,i)=>String(i+1)+'. '+item.name.slice(0,20)).join('\n')+(page>0?'\n8. Previous':'')+((page+1)*4<items.length?'\n9. More':'')+'\n0. Exit'};
 const choice=Number(tokens[cursor]);if(!/^[1-4]$/.test(tokens[cursor])||!visible[choice-1])return {error:true,cursor};
 return {cursor:cursor+1,item:visible[choice-1]};
}
