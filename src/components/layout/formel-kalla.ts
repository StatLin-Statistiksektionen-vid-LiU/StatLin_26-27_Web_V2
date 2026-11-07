/**
 * Formlerna som skrivs i rutnätet (RutnatLjus), ur blocket Handskriften. Sidfoten lämnar dem här (SidfotCitat), så att rutnätet
 * slipper hämta blocket själv. I redigeringsläget är det utkastet, så att en ändrad formel skrivs direkt.
 */
export type RutnatFormel = { tex: string; rod?: true };

let formler: RutnatFormel[] = [];
export const satFormler = (nya: RutnatFormel[]) => {
  formler = nya;
};
export const lasFormler = () => formler;
