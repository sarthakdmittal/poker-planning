import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { socket } from "../socket";
import { FaCopy, FaRegCopy, FaSave, FaTrash, FaEye, FaEyeSlash, FaLock } from "react-icons/fa";
import { encryptCredentials, decryptCredentials } from '../utils/cryptoUtils';

const DICEBEAR_BASE = 'https://api.dicebear.com/9.x';
const AVATAR_BG = 'backgroundColor=b6e3f4,c0aede,d1d4f9,ffd5dc,ffdfbf&radius=50';

// Custom hand-crafted Avataaars (Pablo Stanley / avataaars.com)
const CUSTOM_AVATAR_M1 = "data:image/svg+xml;utf8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%20280%20280%22%20fill%3D%22none%22%20shape-rendering%3D%22auto%22%20width%3D%22300%22%20height%3D%22300%22%3E%3Cmetadata%20xmlns%3Ardf%3D%22http%3A%2F%2Fwww.w3.org%2F1999%2F02%2F22-rdf-syntax-ns%23%22%20xmlns%3Axsi%3D%22http%3A%2F%2Fwww.w3.org%2F2001%2FXMLSchema-instance%22%20xmlns%3Adc%3D%22http%3A%2F%2Fpurl.org%2Fdc%2Felements%2F1.1%2F%22%20xmlns%3Adcterms%3D%22http%3A%2F%2Fpurl.org%2Fdc%2Fterms%2F%22%3E%3Crdf%3ARDF%3E%3Crdf%3ADescription%3E%3Cdc%3Atitle%3EAvataaars%3C%2Fdc%3Atitle%3E%3Cdc%3Acreator%3EPablo%20Stanley%3C%2Fdc%3Acreator%3E%3Cdc%3Asource%20xsi%3Atype%3D%22dcterms%3AURI%22%3Ehttps%3A%2F%2Favataaars.com%2F%3C%2Fdc%3Asource%3E%3Cdcterms%3Alicense%20xsi%3Atype%3D%22dcterms%3AURI%22%3Ehttps%3A%2F%2Favataaars.com%2F%3C%2Fdcterms%3Alicense%3E%3Cdc%3Arights%3ERemix%20of%20%E2%80%9EAvataaars%E2%80%9D%20(https%3A%2F%2Favataaars.com%2F)%20by%20%E2%80%9EPablo%20Stanley%E2%80%9D%2C%20licensed%20under%20%E2%80%9EFree%20for%20personal%20and%20commercial%20use%E2%80%9D%20(https%3A%2F%2Favataaars.com%2F)%3C%2Fdc%3Arights%3E%3C%2Frdf%3ADescription%3E%3C%2Frdf%3ARDF%3E%3C%2Fmetadata%3E%3Cmask%20id%3D%22viewboxMask%22%3E%3Crect%20width%3D%22280%22%20height%3D%22280%22%20rx%3D%220%22%20ry%3D%220%22%20x%3D%220%22%20y%3D%220%22%20fill%3D%22%23fff%22%20%2F%3E%3C%2Fmask%3E%3Cg%20mask%3D%22url(%23viewboxMask)%22%3E%3Cg%20transform%3D%22translate(8)%22%3E%3Cpath%20d%3D%22M132%2036a56%2056%200%200%200-56%2056v6.17A12%2012%200%200%200%2066%20110v14a12%2012%200%200%200%2010.3%2011.88%2056.04%2056.04%200%200%200%2031.7%2044.73v18.4h-4a72%2072%200%200%200-72%2072v9h200v-9a72%2072%200%200%200-72-72h-4v-18.39a56.04%2056.04%200%200%200%2031.7-44.73A12%2012%200%200%200%20198%20124v-14a12%2012%200%200%200-10-11.83V92a56%2056%200%200%200-56-56Z%22%20fill%3D%22%23ffdbb4%22%2F%3E%3Cpath%20d%3D%22M108%20180.61v8a55.79%2055.79%200%200%200%2024%205.39c8.59%200%2016.73-1.93%2024-5.39v-8a55.79%2055.79%200%200%201-24%205.39%2055.79%2055.79%200%200%201-24-5.39Z%22%20fill%3D%22%23000%22%20fill-opacity%3D%22.1%22%2F%3E%3Cg%20transform%3D%22translate(0%20170)%22%3E%3Cpath%20d%3D%22M108%2014.7c-15.52%203.68-27.1%2010.83-30.77%2019.44A72.02%2072.02%200%200%200%2032%20101v9h200v-9a72.02%2072.02%200%200%200-45.23-66.86C183.1%2025.53%20171.52%2018.38%20156%2014.7V32a24%2024%200%201%201-48%200V14.7Z%22%20fill%3D%22%2335c461%22%2F%3E%3Cpath%20d%3D%22M102%2063.34a67.1%2067.1%200%200%201-7-2.82V110h7V63.34ZM162%2063.34a67.04%2067.04%200%200%200%207-2.82V98.5a3.5%203.5%200%201%201-7%200V63.34Z%22%20fill%3D%22%23F4F4F4%22%2F%3E%3Cpath%20d%3D%22M187.62%2034.49a71.79%2071.79%200%200%201%2010.83%205.63C197.11%2055.62%20167.87%2068%20132%2068c30.93%200%2056-13.43%2056-30%200-1.19-.13-2.36-.38-3.51ZM76.38%2034.49a16.48%2016.48%200%200%200-.38%203.5c0%2016.58%2025.07%2030%2056%2030-35.87%200-65.1-12.38-66.45-27.88a71.79%2071.79%200%200%201%2010.83-5.63Z%22%20fill%3D%22%23000%22%20fill-opacity%3D%22.16%22%2F%3E%3C%2Fg%3E%3Cg%20transform%3D%22translate(78%20134)%22%3E%3Cpath%20d%3D%22M40%2016c0%205.37%206.16%209%2014%209s14-3.63%2014-9c0-1.1-.95-2-2-2-1.3%200-1.87.9-2%202-1.24%202.94-4.32%204.72-10%205-5.68-.28-8.76-2.06-10-5-.13-1.1-.7-2-2-2-1.05%200-2%20.9-2%202Z%22%20fill%3D%22%23000%22%20fill-opacity%3D%22.6%22%2F%3E%3C%2Fg%3E%3Cg%20transform%3D%22translate(104%20122)%22%3E%3Cpath%20fill-rule%3D%22evenodd%22%20clip-rule%3D%22evenodd%22%20d%3D%22M16%208c0%204.42%205.37%208%2012%208s12-3.58%2012-8%22%20fill%3D%22%23000%22%20fill-opacity%3D%22.16%22%2F%3E%3C%2Fg%3E%3Cg%20transform%3D%22translate(76%2090)%22%3E%3Cpath%20d%3D%22M44%2020.73c0%204.26-6.27%207.72-14%207.72S16%2025%2016%2020.73C16%2016.46%2022.27%2013%2030%2013s14%203.46%2014%207.73ZM96%2020.73c0%204.26-6.27%207.72-14%207.72S68%2025%2068%2020.73C68%2016.46%2074.27%2013%2082%2013s14%203.46%2014%207.73Z%22%20fill%3D%22%23fff%22%2F%3E%3Cpath%20d%3D%22M32.82%2028.3a25.15%2025.15%200%200%201-5.64%200%206%206%200%201%201%205.64%200ZM84.82%2028.3a25.15%2025.15%200%200%201-5.64%200%206%206%200%201%201%205.64%200Z%22%20fill%3D%22%23000%22%20fill-opacity%3D%22.7%22%2F%3E%3C%2Fg%3E%3Cg%20transform%3D%22translate(76%2082)%22%3E%3Cpath%20d%3D%22M26.55%206.15c-5.8.27-15.2%204.49-14.96%2010.34.01.18.3.27.43.12%202.76-2.96%2022.32-5.95%2029.2-4.36.64.14%201.12-.48.72-.93-3.43-3.85-10.2-5.43-15.4-5.18ZM86.45%206.15c5.8.27%2015.2%204.49%2014.96%2010.34-.01.18-.3.27-.43.12-2.76-2.96-22.32-5.95-29.2-4.36-.64.14-1.12-.48-.72-.93%203.43-3.85%2010.2-5.43%2015.4-5.18Z%22%20fill-rule%3D%22evenodd%22%20clip-rule%3D%22evenodd%22%20fill%3D%22%23000%22%20fill-opacity%3D%22.6%22%2F%3E%3C%2Fg%3E%3Cg%20transform%3D%22translate(-1)%22%3E%3Cpath%20fill-rule%3D%22evenodd%22%20clip-rule%3D%22evenodd%22%20d%3D%22M76%2098c.35%201.49%201.67%201.22%202%200-.46-1.55%203.3-28.75%2013-36%203.62-2.52%2023-4.77%2042.31-4.75%2019.1%200%2038.11%202.26%2041.69%204.75%209.7%207.25%2013.46%2034.45%2013%2036%20.33%201.22%201.65%201.49%202%200%20.72-10.3%200-63.73-57-63-57%20.73-57.72%2052.7-57%2063Z%22%20fill%3D%22%23c93305%22%2F%3E%3C%2Fg%3E%3Cg%20transform%3D%22translate(49%2072)%22%3E%3C%2Fg%3E%3Cg%20transform%3D%22translate(62%2042)%22%3E%3C%2Fg%3E%3C%2Fg%3E%3C%2Fg%3E%3C%2Fsvg%3E";
const CUSTOM_AVATAR_M2 = "data:image/svg+xml;utf8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%20280%20280%22%20fill%3D%22none%22%20shape-rendering%3D%22auto%22%20width%3D%22300%22%20height%3D%22300%22%3E%3Cmetadata%20xmlns%3Ardf%3D%22http%3A%2F%2Fwww.w3.org%2F1999%2F02%2F22-rdf-syntax-ns%23%22%20xmlns%3Axsi%3D%22http%3A%2F%2Fwww.w3.org%2F2001%2FXMLSchema-instance%22%20xmlns%3Adc%3D%22http%3A%2F%2Fpurl.org%2Fdc%2Felements%2F1.1%2F%22%20xmlns%3Adcterms%3D%22http%3A%2F%2Fpurl.org%2Fdc%2Fterms%2F%22%3E%3Crdf%3ARDF%3E%3Crdf%3ADescription%3E%3Cdc%3Atitle%3EAvataaars%3C%2Fdc%3Atitle%3E%3Cdc%3Acreator%3EPablo%20Stanley%3C%2Fdc%3Acreator%3E%3Cdc%3Asource%20xsi%3Atype%3D%22dcterms%3AURI%22%3Ehttps%3A%2F%2Favataaars.com%2F%3C%2Fdc%3Asource%3E%3Cdcterms%3Alicense%20xsi%3Atype%3D%22dcterms%3AURI%22%3Ehttps%3A%2F%2Favataaars.com%2F%3C%2Fdcterms%3Alicense%3E%3Cdc%3Arights%3ERemix%20of%20%E2%80%9EAvataaars%E2%80%9D%20(https%3A%2F%2Favataaars.com%2F)%20by%20%E2%80%9EPablo%20Stanley%E2%80%9D%2C%20licensed%20under%20%E2%80%9EFree%20for%20personal%20and%20commercial%20use%E2%80%9D%20(https%3A%2F%2Favataaars.com%2F)%3C%2Fdc%3Arights%3E%3C%2Frdf%3ADescription%3E%3C%2Frdf%3ARDF%3E%3C%2Fmetadata%3E%3Cmask%20id%3D%22viewboxMask%22%3E%3Crect%20width%3D%22280%22%20height%3D%22280%22%20rx%3D%220%22%20ry%3D%220%22%20x%3D%220%22%20y%3D%220%22%20fill%3D%22%23fff%22%20%2F%3E%3C%2Fmask%3E%3Cg%20mask%3D%22url(%23viewboxMask)%22%3E%3Cg%20transform%3D%22translate(8)%22%3E%3Cpath%20d%3D%22M132%2036a56%2056%200%200%200-56%2056v6.17A12%2012%200%200%200%2066%20110v14a12%2012%200%200%200%2010.3%2011.88%2056.04%2056.04%200%200%200%2031.7%2044.73v18.4h-4a72%2072%200%200%200-72%2072v9h200v-9a72%2072%200%200%200-72-72h-4v-18.39a56.04%2056.04%200%200%200%2031.7-44.73A12%2012%200%200%200%20198%20124v-14a12%2012%200%200%200-10-11.83V92a56%2056%200%200%200-56-56Z%22%20fill%3D%22%23f8d25c%22%2F%3E%3Cpath%20d%3D%22M108%20180.61v8a55.79%2055.79%200%200%200%2024%205.39c8.59%200%2016.73-1.93%2024-5.39v-8a55.79%2055.79%200%200%201-24%205.39%2055.79%2055.79%200%200%201-24-5.39Z%22%20fill%3D%22%23000%22%20fill-opacity%3D%22.1%22%2F%3E%3Cg%20transform%3D%22translate(0%20170)%22%3E%3Cpath%20d%3D%22M132.5%2054C151%2054%20166%2044.37%20166%2032.5c0-1.1-.13-2.18-.38-3.23A72%2072%200%200%201%20232%20101.05V110H32v-8.95A72%2072%200%200%201%2099.4%2029.2a14.1%2014.1%200%200%200-.4%203.3C99%2044.37%20114%2054%20132.5%2054Z%22%20fill%3D%22%23c71d1d%22%2F%3E%3Cg%20transform%3D%22translate(77%2058)%22%3E%3Cg%20fill-rule%3D%22evenodd%22%20clip-rule%3D%22evenodd%22%20fill%3D%22%23fff%22%3E%3Cpath%20d%3D%22M72.34%2018.04a8.66%208.66%200%200%201-1%202.99c-.71%201.21-2.02%201.7-2.78%202.82-1.19%201.75.4%204.27-.78%205.83-1.27%201.68-4.14.67-5.26%202.9-1.18%202.35.53%205.49-.95%207.83-1.47-.37-1.92-5.9-4.19-2.37-1.45%202.25-.47%203.47-2.64.23-.76-1.12-1.62-2.13-3.1-1.39-1.04.52-1.26%202.84-2.21%203.09-2.33.6-2.42-5.62-3.21-6.8a2.8%202.8%200%200%200-1.62-1.28c-.67-.2-1.87.22-2.43-.1-1.04-.59-1.18-2.55-1.22-3.6-.07-1.93.58-3.91.04-5.83-.45-1.61-1.89-2.6-2.36-4.18C36.1%209.64%2047.68%204.89%2054.3%204.63c7.74-.3%2019.04%204.22%2018.04%2013.4Zm1.83-5.32c-1.45-3.44-4.65-6.17-7.91-8-1.59-.9-3.3-1.56-5.09-1.95-1.64-.36-3.55-.12-5.12-.58C54.73%201.81%2053.9.95%2052.35%201c-2.11.07-4.31%201.17-6.16%202.09-3.66%201.8-6.77%204.15-8.73%207.74-2.1%203.86-1.9%207.36.35%2010.95%202.15%203.44-.97%208.27%202.17%2011.53%201.32%201.37%202.62.37%203.87%201.03.96.5.92%203.46%201.19%204.33%201.2%203.9%205.51%205.4%207.5%201.2.94%202.34%204.66%204.75%206.39%201.68%201.08%201.4%202.95%202%204.38.8%201.35-1.14%201.5-3.76%201.56-5.35.06-1.24-.5-2.77.46-3.66%201.04-.98%203.2-.57%204.37-1.84%201.34-1.45.78-3.14.89-4.87.1-1.75.41-1.3%201.7-2.56%202.9-2.81%203.38-7.8%201.88-11.35Z%22%2F%3E%3Cpath%20d%3D%22M50.42%2029.12c2.02-1.82%201.6-7.4%201.42-9.96-.31-4.86-3.35-3.4-5.2-.38-1.4%202.3-4.77%206-3.26%208.88%201.2%202.3%205.18%203.13%207.04%201.46ZM63.8%2020.27c-1.04-1.92-1.43-2.2-2.66-3.78-.8-1.01-1.9-2.8-3.4-2.44-2.59.62-1.53%206.6-1.5%208.4.02%201.36-.28%202.76.85%203.73%201.15.98%203.05.9%204.44.69%204.26-.64%204.06-3.26%202.26-6.6ZM55.24%2032.83c-.28-.04.08-.36.12-.59.19.62.33.65-.12.59Zm1.04-4.31c-2.61-2.77-7.57%206.4-4.08%207.43.8.23%201.4-.37%202.16-.47%201.1-.16%202.02.48%202.97-.53%201.5-1.58.2-5.1-1.05-6.43Z%22%2F%3E%3C%2Fg%3E%3C%2Fg%3E%3C%2Fg%3E%3Cg%20transform%3D%22translate(78%20134)%22%3E%3Cpath%20fill-rule%3D%22evenodd%22%20clip-rule%3D%22evenodd%22%20d%3D%22M40%2015a14%2014%200%201%200%2028%200%22%20fill%3D%22%23000%22%20fill-opacity%3D%22.7%22%2F%3E%3C%2Fg%3E%3Cg%20transform%3D%22translate(104%20122)%22%3E%3Cpath%20fill-rule%3D%22evenodd%22%20clip-rule%3D%22evenodd%22%20d%3D%22M16%208c0%204.42%205.37%208%2012%208s12-3.58%2012-8%22%20fill%3D%22%23000%22%20fill-opacity%3D%22.16%22%2F%3E%3C%2Fg%3E%3Cg%20transform%3D%22translate(76%2090)%22%3E%3Cpath%20d%3D%22M44%2020.73c0%204.26-6.27%207.72-14%207.72S16%2025%2016%2020.73C16%2016.46%2022.27%2013%2030%2013s14%203.46%2014%207.73ZM96%2020.73c0%204.26-6.27%207.72-14%207.72S68%2025%2068%2020.73C68%2016.46%2074.27%2013%2082%2013s14%203.46%2014%207.73Z%22%20fill%3D%22%23fff%22%2F%3E%3Cpath%20d%3D%22M32.82%2028.3a25.15%2025.15%200%200%201-5.64%200%206%206%200%201%201%205.64%200ZM84.82%2028.3a25.15%2025.15%200%200%201-5.64%200%206%206%200%201%201%205.64%200Z%22%20fill%3D%22%23000%22%20fill-opacity%3D%22.7%22%2F%3E%3C%2Fg%3E%3Cg%20transform%3D%22translate(76%2082)%22%3E%3Cpath%20d%3D%22M15.98%2017.13C17.48%207.6%2030.06%201.1%2039.16%205.3a2%202%200%201%200%201.68-3.63c-11.5-5.3-26.9%202.66-28.82%2014.84a2%202%200%200%200%203.96.63ZM96.02%2017.13C94.52%207.6%2081.94%201.1%2072.84%205.3a2%202%200%201%201-1.68-3.63c11.5-5.3%2026.9%202.66%2028.82%2014.84a2%202%200%200%201-3.96.63Z%22%20fill%3D%22%23000%22%20fill-opacity%3D%22.6%22%2F%3E%3C%2Fg%3E%3Cg%20transform%3D%22translate(-1)%22%3E%3Cg%20fill%3D%22%23a55728%22%3E%3Cpath%20d%3D%22M187.7%2056.12c.9%203.25%202.17%2011.95-.06%2014.84-.75.96-5.84-1.74-7.97-2.92l-3.53-1.96c-14.92-8.32-19.74-11-45.9-10.62-28.11.4-47.37%2013.58-48.46%2014.93-.75.93-1.71%203.44-2.5%2010.41-.25%202.2-.32%204.97-.4%207.71-.14%205.94-.3%2011.77-2.25%2011.76-2.44-.01-2.97-23.78-1.92-33.21.04-.36.1-.78.18-1.23.23-1.4.5-3.13.16-4.11-.16-.44-.54-.7-.94-.99-.62-.43-1.26-.88-1.08-2.03.21-1.31%201.1-1.43%201.97-1.56.57-.08%201.13-.16%201.5-.56%201.13-1.23.46-1.87-.31-2.6-.46-.43-.95-.9-1.12-1.53-.63-2.36%201.03-3.1%202.69-3.83l.38-.17c.69-.3%201.1-.42%201.42-.5.6-.15.85-.21%201.89-1.35-2.14-1.56-2.9-3.69.01-4.83.56-.22%201.52-.2%202.5-.2%201.2.02%202.4.03%202.94-.37.15-.11.24-.53.33-.9.06-.27.11-.5.18-.6%201.35-1.93%201.23-3.4%201.08-5.4l-.07-.92c-.13-2.04-.11-3.9%202.33-4.11%201-.08%201.9.4%202.77.86.54.29%201.08.58%201.64.73.87.23%201.1.43%201.32.43.19%200%20.37-.15.96-.55%201.18-.82%201.3-2.05%201.43-3.3.11-1.08.22-2.18%201.04-3%201.58-1.6%202.8-.64%204%20.3.64.5%201.28%201%201.96%201.1%202.55.36%203.06-1.06%203.62-2.59.36-1%20.74-2.06%201.74-2.68%201.83-1.15%202.64-.05%203.43%201.01.5.68.98%201.33%201.7%201.39%201.01.08%202.52-1.1%203.85-2.14a11.6%2011.6%200%200%201%202.1-1.44c2.27-.93%203.91.07%205.58%201.08%201.4.85%202.83%201.72%204.65%201.43l.83-.13c2.24-.37%203.11-.51%205.45.96a4.2%204.2%200%200%200%203.74.69c.6-.12%201.3-.25%202.26-.26%201.1%200%201.98.5%202.83.99.7.4%201.36.79%202.13.87.42.04.84-.16%201.26-.36.42-.2.84-.4%201.3-.38%201.83.11%202.69%201.5%203.55%202.88.67%201.08%201.34%202.15%202.46%202.66%201.62.72%203.44.24%205.17-.21.79-.2%201.55-.4%202.28-.5%203.96-.46%203.27%201.97%202.55%204.56a11.1%2011.1%200%200%200-.6%203.26c1.15.27%202.3-.15%203.46-.57%201.1-.4%202.18-.8%203.27-.6%203.4.58%202.25%204.02%201.44%206.45l-.08.21c.64%200%201.54-.2%202.56-.42%202.86-.6%206.61-1.41%207.78%201.13.47%201.05%200%202.31-.44%203.54a7.17%207.17%200%200%200-.61%202.41c.02%201.53.7%202.9%201.4%204.27.45.91.9%201.82%201.17%202.78Z%22%2F%3E%3Cpath%20d%3D%22m186.36%2073.6.47.33c1.76.99%203.15%2010.9%203.22%2014.69.04%202.34.08%2011.25-2.4%2010.48-.75-.23-1.9-4.95-2.06-7.72-.16-2.76-1.74-12.16-4.14-16.49-.13-.23-.32-.51-.53-.8-.65-.96-1.44-2.12-.92-2.76.72-.88%201.43-.57%202.26-.2l.44.18c.87.35%202.77%201.68%203.66%202.3Z%22%2F%3E%3C%2Fg%3E%3C%2Fg%3E%3Cg%20transform%3D%22translate(49%2072)%22%3E%3Cpath%20fill-rule%3D%22evenodd%22%20clip-rule%3D%22evenodd%22%20d%3D%22M101.43%2098.17c-2.52%202.3-5.2%203.32-8.58%202.6-.58-.12-2.95-4.54-8.85-4.54-5.9%200-8.27%204.42-8.85%204.54-3.39.72-6.07-.3-8.58-2.6-4.72-4.31-8.65-10.26-6.3-16.75%201.24-3.38%203.24-7.1%206.88-8.17%203.89-1.15%209.35%200%2013.26-.8A8.6%208.6%200%200%200%2084%2071a8.6%208.6%200%200%200%203.58%201.46c3.92.78%209.38-.36%2013.27.79%203.64%201.07%205.64%204.79%206.87%208.17%202.36%206.49-1.57%2012.44-6.3%2016.75ZM140.08%2026c-3.4%208.4-2.1%2018.86-2.72%2027.68-.52%207.16-2.02%2017.9-8.39%2022.53-3.25%202.37-9.18%206.35-13.43%205.24-2.93-.76-3.24-9.16-7.09-12.3a22.42%2022.42%200%200%200-15.3-4.9c-2.37.11-7.17.09-9.15%201.91-1.98-1.82-6.78-1.8-9.15-1.9a22.42%2022.42%200%200%200-15.3%204.89c-3.85%203.14-4.16%2011.54-7.1%2012.3-4.24%201.1-10.17-2.87-13.42-5.24-6.37-4.62-7.87-15.37-8.39-22.53-.63-8.82.69-19.28-2.72-27.68-1.66%200-.57%2016.13-.57%2016.13v20.36c.04%2015.28%209.59%2038.16%2030.76%2046.9C63.29%20111.53%2075%20115%2084%20115c8.98.01%2020.71-3.13%2025.9-5.27%2021.16-8.73%2030.71-31.95%2030.75-47.23V42.13s1.1-16.13-.57-16.13Z%22%20fill%3D%22%23c93305%22%2F%3E%3C%2Fg%3E%3Cg%20transform%3D%22translate(62%2042)%22%3E%3Cg%20fill-rule%3D%22evenodd%22%20clip-rule%3D%22evenodd%22%3E%3Cpath%20d%3D%22M111.71%2053.49c4.67.16%208%20.88%2010.55%204.52%203.01.15%206.25.37%208.98%201.63%203.39%201.56%203.9%205.1-.36%205.59-1.86.2-3.72-.12-5.55-.45l-.19-.03-.33-.06c1.1%209.46-6.21%2020.87-14.23%2024.35C99.6%2093.8%2087.34%2088.53%2081.53%2079c-2.62-4.3-4.14-10.51-4.46-15.86-.42-.2-.83-.44-1.23-.67-.38-.22-.76-.44-1.12-.61-2-.98-5.34-1.1-7.5%200-.35.17-.7.37-1.05.58-.42.25-.86.5-1.3.72C64.53%2068.5%2063.01%2074.7%2060.4%2079c-5.8%209.53-18.07%2014.8-29.05%2010.04-8.02-3.48-15.33-14.89-14.23-24.35l-.33.06-.2.03c-1.83.33-3.7.66-5.55.45-4.27-.5-3.74-4.03-.36-5.6%202.72-1.25%205.96-1.47%208.97-1.62%202.55-3.63%205.88-4.36%2010.55-4.52l23.29-.46c5.19-.14%209.72%200%2011.03%204.6a18.7%2018.7%200%200%201%206.35-1.25c1.86%200%204.35.45%206.5%201.28%201.3-4.64%205.83-4.77%2011.03-4.63l23.3.46Zm-24.03%206.78c-2.37.03-3.5.42-3.9%202.9-.4%202.5%200%205.31.46%207.78.73%203.77%201.92%207.46%204.71%2010.22a16.24%2016.24%200%200%200%208.32%204.34c.11.03.54.1.96.16.63.1%201.23.18.71.13l-.1-.01h-.06a47.08%2047.08%200%200%201%20.16%200c3.73.4%207.72.32%2010.82-2.04%203.53-2.7%205.95-6.95%207.01-11.2.63-2.48%201.93-8.42-.46-10.4-2.73-2.28-28.63-1.88-28.63-1.88Zm-33.43%200c2.37.03%203.5.42%203.9%202.9.4%202.5%200%205.32-.46%207.78-.73%203.77-1.92%207.46-4.71%2010.22a16.23%2016.23%200%200%201-8.32%204.35l-.96.15c-.64.1-1.26.19-.68.13-3.73.4-7.74.32-10.85-2.05-3.53-2.69-5.95-6.95-7.01-11.2-.63-2.48-1.93-8.42.46-10.4%202.73-2.28%2028.63-1.87%2028.63-1.87Zm-10.93%2025.5Z%22%20fill%3D%22%23000%22%20fill-opacity%3D%22.1%22%2F%3E%3Cpath%20d%3D%22M111.71%2051.49c4.67.16%208%20.88%2010.55%204.52%203.01.15%206.25.37%208.98%201.63%203.39%201.56%203.9%205.1-.36%205.59-1.86.2-3.72-.12-5.55-.45l-.19-.03-.33-.06c1.1%209.46-6.21%2020.87-14.23%2024.35C99.6%2091.8%2087.34%2086.53%2081.53%2077c-2.62-4.3-4.14-10.51-4.46-15.86-.42-.2-.83-.44-1.23-.67-.38-.22-.76-.44-1.12-.61-2-.98-5.34-1.1-7.5%200-.35.17-.7.37-1.05.58-.42.25-.86.5-1.3.72C64.53%2066.5%2063.01%2072.7%2060.4%2077c-5.8%209.53-18.07%2014.8-29.05%2010.04-8.02-3.48-15.33-14.89-14.23-24.35-.11%200-.22.03-.33.05l-.2.03c-1.83.33-3.7.66-5.55.45-4.27-.5-3.74-4.03-.36-5.6%202.72-1.25%205.96-1.47%208.97-1.62%202.55-3.63%205.88-4.36%2010.55-4.52l23.29-.46c5.19-.14%209.72%200%2011.03%204.6a18.7%2018.7%200%200%201%206.35-1.25c1.86%200%204.35.45%206.5%201.28%201.3-4.64%205.83-4.77%2011.03-4.63l23.3.46Zm-24.03%206.78c-2.37.03-3.5.42-3.9%202.9-.4%202.5%200%205.31.46%207.78.73%203.77%201.92%207.46%204.71%2010.22a16.24%2016.24%200%200%200%208.32%204.34c.11.03.54.1.96.16.63.1%201.23.18.71.13l-.1-.01h-.06a47.08%2047.08%200%200%201%20.16%200c3.73.4%207.72.32%2010.82-2.04%203.53-2.7%205.95-6.95%207.01-11.2.63-2.48%201.93-8.42-.46-10.4-2.73-2.28-28.63-1.88-28.63-1.88Zm-33.43%200c2.37.03%203.5.42%203.9%202.9.4%202.5%200%205.32-.46%207.78-.73%203.77-1.92%207.46-4.71%2010.22a16.23%2016.23%200%200%201-8.32%204.35l-.96.15c-.64.1-1.26.19-.68.13-3.73.4-7.74.32-10.85-2.05-3.53-2.69-5.95-6.95-7.01-11.2-.63-2.48-1.93-8.42.46-10.4%202.73-2.28%2028.63-1.87%2028.63-1.87Zm-10.93%2025.5Z%22%20fill%3D%22%233c4f5c%22%2F%3E%3C%2Fg%3E%3C%2Fg%3E%3C%2Fg%3E%3C%2Fg%3E%3C%2Fsvg%3E";
const CUSTOM_AVATAR_F1 = "data:image/svg+xml;utf8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%20280%20280%22%20fill%3D%22none%22%20shape-rendering%3D%22auto%22%20width%3D%22300%22%20height%3D%22300%22%3E%3Cmetadata%20xmlns%3Ardf%3D%22http%3A%2F%2Fwww.w3.org%2F1999%2F02%2F22-rdf-syntax-ns%23%22%20xmlns%3Axsi%3D%22http%3A%2F%2Fwww.w3.org%2F2001%2FXMLSchema-instance%22%20xmlns%3Adc%3D%22http%3A%2F%2Fpurl.org%2Fdc%2Felements%2F1.1%2F%22%20xmlns%3Adcterms%3D%22http%3A%2F%2Fpurl.org%2Fdc%2Fterms%2F%22%3E%3Crdf%3ARDF%3E%3Crdf%3ADescription%3E%3Cdc%3Atitle%3EAvataaars%3C%2Fdc%3Atitle%3E%3Cdc%3Acreator%3EPablo%20Stanley%3C%2Fdc%3Acreator%3E%3Cdc%3Asource%20xsi%3Atype%3D%22dcterms%3AURI%22%3Ehttps%3A%2F%2Favataaars.com%2F%3C%2Fdc%3Asource%3E%3Cdcterms%3Alicense%20xsi%3Atype%3D%22dcterms%3AURI%22%3Ehttps%3A%2F%2Favataaars.com%2F%3C%2Fdcterms%3Alicense%3E%3Cdc%3Arights%3ERemix%20of%20%E2%80%9EAvataaars%E2%80%9D%20(https%3A%2F%2Favataaars.com%2F)%20by%20%E2%80%9EPablo%20Stanley%E2%80%9D%2C%20licensed%20under%20%E2%80%9EFree%20for%20personal%20and%20commercial%20use%E2%80%9D%20(https%3A%2F%2Favataaars.com%2F)%3C%2Fdc%3Arights%3E%3C%2Frdf%3ADescription%3E%3C%2Frdf%3ARDF%3E%3C%2Fmetadata%3E%3Cmask%20id%3D%22viewboxMask%22%3E%3Crect%20width%3D%22280%22%20height%3D%22280%22%20rx%3D%220%22%20ry%3D%220%22%20x%3D%220%22%20y%3D%220%22%20fill%3D%22%23fff%22%20%2F%3E%3C%2Fmask%3E%3Cg%20mask%3D%22url(%23viewboxMask)%22%3E%3Cg%20transform%3D%22translate(8)%22%3E%3Cpath%20d%3D%22M132%2036a56%2056%200%200%200-56%2056v6.17A12%2012%200%200%200%2066%20110v14a12%2012%200%200%200%2010.3%2011.88%2056.04%2056.04%200%200%200%2031.7%2044.73v18.4h-4a72%2072%200%200%200-72%2072v9h200v-9a72%2072%200%200%200-72-72h-4v-18.39a56.04%2056.04%200%200%200%2031.7-44.73A12%2012%200%200%200%20198%20124v-14a12%2012%200%200%200-10-11.83V92a56%2056%200%200%200-56-56Z%22%20fill%3D%22%23ffdbb4%22%2F%3E%3Cpath%20d%3D%22M108%20180.61v8a55.79%2055.79%200%200%200%2024%205.39c8.59%200%2016.73-1.93%2024-5.39v-8a55.79%2055.79%200%200%201-24%205.39%2055.79%2055.79%200%200%201-24-5.39Z%22%20fill%3D%22%23000%22%20fill-opacity%3D%22.1%22%2F%3E%3Cg%20transform%3D%22translate(0%20170)%22%3E%3Cpath%20d%3D%22M92.68%2029.94A72.02%2072.02%200%200%200%2032%20101.05V110h200v-8.95a72.02%2072.02%200%200%200-60.68-71.11%2023.87%2023.87%200%200%201-7.56%2013.6l-29.08%2026.23a4%204%200%200%201-5.36%200l-29.08-26.23a23.87%2023.87%200%200%201-7.56-13.6Z%22%20fill%3D%22%233c4f5c%22%2F%3E%3C%2Fg%3E%3Cg%20transform%3D%22translate(78%20134)%22%3E%3Cpath%20fill-rule%3D%22evenodd%22%20clip-rule%3D%22evenodd%22%20d%3D%22M40%2015a14%2014%200%201%200%2028%200%22%20fill%3D%22%23000%22%20fill-opacity%3D%22.7%22%2F%3E%3C%2Fg%3E%3Cg%20transform%3D%22translate(104%20122)%22%3E%3Cpath%20fill-rule%3D%22evenodd%22%20clip-rule%3D%22evenodd%22%20d%3D%22M16%208c0%204.42%205.37%208%2012%208s12-3.58%2012-8%22%20fill%3D%22%23000%22%20fill-opacity%3D%22.16%22%2F%3E%3C%2Fg%3E%3Cg%20transform%3D%22translate(76%2090)%22%3E%3Cpath%20d%3D%22M36%2022a6%206%200%201%201-12%200%206%206%200%200%201%2012%200ZM88%2022a6%206%200%201%201-12%200%206%206%200%200%201%2012%200Z%22%20fill%3D%22%23000%22%20fill-opacity%3D%22.6%22%2F%3E%3C%2Fg%3E%3Cg%20transform%3D%22translate(76%2082)%22%3E%3Cpath%20d%3D%22m22.77%201.58.9-.4C28.93-.91%2036.88-.03%2041.73%202.3c.57.27.18%201.15-.4%201.1-14.92-1.14-24.96%208.15-28.37%2014.45-.1.18-.41.2-.49.03-2.3-5.32%204.45-13.98%2010.3-16.3ZM89.23%201.58l-.9-.4C83.07-.91%2075.12-.03%2070.27%202.3c-.57.27-.18%201.15.4%201.1%2014.92-1.14%2024.96%208.15%2028.37%2014.45.1.18.41.2.49.03%202.3-5.32-4.45-13.98-10.3-16.3Z%22%20fill-rule%3D%22evenodd%22%20clip-rule%3D%22evenodd%22%20fill%3D%22%23000%22%20fill-opacity%3D%22.6%22%2F%3E%3C%2Fg%3E%3Cg%20transform%3D%22translate(-1)%22%3E%3Cpath%20d%3D%22M50%2090.5c0%204.55%201.7%208.64%204.85%2010.77.9.61%202.47.93%204.15%201.07V182a8%208%200%200%200%208%208h42v-9.39a56.03%2056.03%200%200%201-31.8-45.74A12%2012%200%200%201%2067%20123v-13c0-3.5%201.5-6.63%203.87-8.83%2011.54-2.61%2024.1-7.53%2036.47-14.67%2012.13-7%2022.5-15.24%2030.48-23.75a87.36%2087.36%200%200%201-12.45%2020.78c12.68-5.52%2021.3-14.4%2025.9-26.63.37.92.76%201.84%201.17%202.76%2010.26%2023.03%2027.88%2039.36%2045.77%2044.74.5%202.11.79%204.08.79%205.6v13a12%2012%200%200%201-10.2%2011.87A56.03%2056.03%200%200%201%20157%20180.6V190h18a32%2032%200%200%200%2032-32v-54.12c0-.07%200-.17-.03-.28-.07-5.64-.28-18.87-.6-21.37A74.01%2074.01%200%200%200%20132.99%2018c-36.08%200-66.14%2025.83-73%2060-5.52%200-10%205.6-10%2012.5Z%22%20fill%3D%22%23923d20%22%2F%3E%3Cpath%20d%3D%22M152.44%2059.66c11.94%2026.81%2033.86%2044.53%2054.56%2046.5V92A74%2074%200%200%200%2060.32%2078H60c-5.52%200-10%205.6-10%2012.5%200%206.48%203.95%2011.81%209%2012.44v.15l.95-.1H60a8.1%208.1%200%200%200%201.9-.22C75.7%20101%2091.68%2095.54%20107.34%2086.5c12.13-7%2022.5-15.24%2030.48-23.75a87.36%2087.36%200%200%201-12.45%2020.78c12.68-5.52%2021.3-14.4%2025.9-26.63.37.92.76%201.84%201.17%202.76Z%22%20fill%3D%22%23fff%22%20fill-opacity%3D%22.08%22%2F%3E%3C%2Fg%3E%3Cg%20transform%3D%22translate(49%2072)%22%3E%3C%2Fg%3E%3Cg%20transform%3D%22translate(62%2042)%22%3E%3C%2Fg%3E%3C%2Fg%3E%3C%2Fg%3E%3C%2Fsvg%3E";

const EMOJI_AVATARS = ['🐺','🦁','🐯','🐻','🐼','🐨','🐸','🦄','🐲','🦅','🦉','🦋','🐙','🦀','🐬','🧙','🦸','🧛','🤖','👻','👽','🥷','🧝','🧜','🧚','🐱','🐶','🐧','🔥','🚀','⚡'];

const MALE_HAIR   = 'top=shortCurly,shortFlat,shortRound,shortWaved,sides,theCaesar,theCaesarAndSidePart,shavedSides,shaggy,shaggyMullet,dreads01,dreads02';
const FEMALE_HAIR = 'top=bigHair,bob,bun,curly,curvy,fro,froBand,longButNotTooLong,miaWallace,straight01,straight02,straightAndStrand&facialHairProbability=0';

const AVATAR_SEEDS = {
  male:   { style: 'avataaars',          params: MALE_HAIR,    custom: [CUSTOM_AVATAR_M1, CUSTOM_AVATAR_M2], seeds: ['Felix', 'Max', 'Oliver', 'Noah', 'Ethan', 'Jack', 'Henry', 'Leo', 'Oscar', 'James', 'Charlie', 'Hugo', 'Liam', 'Mason', 'Aiden', 'Lucas', 'Elijah', 'Logan', 'Caleb', 'Ryan'] },
  female: { style: 'avataaars',          params: FEMALE_HAIR,  custom: [CUSTOM_AVATAR_F1],                   seeds: ['Sophie', 'Emma', 'Lily', 'Mia', 'Ava', 'Grace', 'Ruby', 'Clara', 'Zoe', 'Luna', 'Stella', 'Aria', 'Chloe', 'Isabella', 'Olivia', 'Nora', 'Elena', 'Violet', 'Harper', 'Aurora'] },
  other:  { style: 'notionists-neutral', params: '',           custom: [],                                    seeds: ['Alex', 'Riley', 'Jordan', 'Casey', 'Morgan', 'Taylor', 'Avery', 'Quinn', 'Sage', 'Rowan', 'Sky', 'River'] },
};
const getAvatarUrl = (style, seed, params = '') =>
  `${DICEBEAR_BASE}/${style}/svg?seed=${encodeURIComponent(seed)}&${AVATAR_BG}${params ? '&' + params : ''}`;
const resizeImage = (file) => new Promise((resolve) => {
  const reader = new FileReader();
  reader.onload = (ev) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const size = Math.min(img.width, img.height);
      canvas.width = 100; canvas.height = 100;
      canvas.getContext('2d').drawImage(img,
        (img.width - size) / 2, (img.height - size) / 2, size, size, 0, 0, 100, 100);
      resolve(canvas.toDataURL('image/jpeg', 0.82));
    };
    img.src = ev.target.result;
  };
  reader.readAsDataURL(file);
});

// Define ESTIMATION_SCALES
const ESTIMATION_SCALES = {
  FIBONACCI: {
    name: 'Fibonacci',
    cards: [0, 1, 2, 3, 5, 8, 13, 21],
    description: 'Classic Fibonacci sequence'
  },
  FIBONACCI_MODIFIED: {
    name: 'Modified Fibonacci',
    cards: [0, 0.5, 1, 2, 3, 5, 8, 13, 20, 40, 100],
    description: 'Extended Fibonacci with half points and larger values'
  },
  T_SHIRTS: {
    name: 'T-Shirt Sizes',
    cards: ['XS', 'S', 'M', 'L', 'XL', 'XXL'],
    description: 'Relative sizing with T-shirt sizes'
  },
  POWDER_TWO: {
    name: 'Powers of 2',
    cards: [0, 1, 2, 4, 8, 16, 32, 64],
    description: 'Exponential scale using powers of 2'
  },
  LINEAR: {
    name: 'Linear',
    cards: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
    description: 'Simple linear scale 0-10'
  },
  CUSTOM: {
    name: 'Custom',
    cards: [],
    description: 'Define your own custom scale'
  }
};

export default function CreateRoom({ setName }) {
  const navigate = useNavigate();
  const [error, setError] = useState('');
  const [generatedRoomId, setGeneratedRoomId] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [selectedIcon, setSelectedIcon] = useState(() => localStorage.getItem('pokerUserIcon'));
  const [selectedGender, setSelectedGender] = useState(() => localStorage.getItem('pokerUserGender'));
  const fileInputRef = useRef(null);
  const [roomIdCopied, setRoomIdCopied] = useState(false);
  const [socketConnected, setSocketConnected] = useState(socket.connected);
  const [userNameState, setUserNameState] = useState(() => localStorage.getItem('pokerUserName') || '');
  const [selectedScale, setSelectedScale] = useState('FIBONACCI');
  const [customScaleInput, setCustomScaleInput] = useState('');
  const [showCustomScaleInput, setShowCustomScaleInput] = useState(false);

  // Jira integration state
  const [enableJira, setEnableJira] = useState(false);
  const [jiraEmail, setJiraEmail] = useState('');
  const [jiraToken, setJiraToken] = useState('');
  const [showJiraToken, setShowJiraToken] = useState(false);

  // Saved / PIN state
  const [hasEncryptedCreds, setHasEncryptedCreds] = useState(false);
  const [hasLegacyCreds, setHasLegacyCreds] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

  // PIN modal: mode is null | 'save' | 'load' | 'migrate'
  const [pinModal, setPinModal] = useState(null);
  const [pinValue, setPinValue] = useState('');
  const [pinConfirm, setPinConfirm] = useState('');
  const [pinError, setPinError] = useState('');
  const [pinLoading, setPinLoading] = useState(false);

  // Detect stored credentials on mount
  useEffect(() => {
    setHasEncryptedCreds(!!localStorage.getItem('jiraCredentials'));
    // Legacy plain-text keys (pre-encryption)
    setHasLegacyCreds(
      !!localStorage.getItem('jiraEmail') && !!localStorage.getItem('jiraToken')
    );
  }, []);

  useEffect(() => {
    const newRoomId = Math.random().toString(36).substring(2, 8).toUpperCase();
    setGeneratedRoomId(newRoomId);
  }, []);

  useEffect(() => {
    const onConnect = () => {
      console.log("Socket connected in CreateRoom");
      setSocketConnected(true);
      setError('');
    };

    const onDisconnect = () => {
      console.log("Socket disconnected in CreateRoom");
      setSocketConnected(false);
      setError('Disconnected from server. Please refresh.');
    };

    const onConnectError = (error) => {
      console.error("Socket connection error in CreateRoom:", error);
      setSocketConnected(false);
      setError('Cannot connect to server. Please check if backend is running.');
    };

    const handleRoomCreated = ({ roomId, adminSecret }) => {
      console.log('Room created successfully:', roomId);
      // Persist the admin secret so this device can always rejoin as admin
      if (adminSecret) {
        localStorage.setItem(`adminSecret_${roomId}`, adminSecret);
      }
      setIsLoading(false);
      navigate(`/room/${roomId}`, {
        state: { userName: userNameState }
      });
    };

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('connect_error', onConnectError);
    socket.on('room-created', handleRoomCreated);

    setSocketConnected(socket.connected);

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('connect_error', onConnectError);
      socket.off('room-created', handleRoomCreated);
    };
  }, [navigate, userNameState]);

  const showMessage = (type, text) => {
    setMessage({ type, text });
    setTimeout(() => setMessage({ type: '', text: '' }), 3000);
  };

  const openPinModal = (mode) => {
    setPinValue('');
    setPinConfirm('');
    setPinError('');
    setPinLoading(false);
    setPinModal(mode);
  };

  const closePinModal = () => {
    setPinModal(null);
    setPinValue('');
    setPinConfirm('');
    setPinError('');
  };

  const handlePinConfirm = async () => {
    if (!pinValue.trim()) {
      setPinError('Please enter a PIN.');
      return;
    }

    if ((pinModal === 'save' || pinModal === 'migrate') && pinValue !== pinConfirm) {
      setPinError('PINs do not match.');
      return;
    }

    setPinLoading(true);
    setPinError('');

    try {
      if (pinModal === 'save') {
        if (!jiraEmail.trim() || !jiraToken.trim()) {
          setPinError('Please enter email and token first.');
          setPinLoading(false);
          return;
        }
        const encrypted = await encryptCredentials(
          { email: jiraEmail.trim(), token: jiraToken.trim() },
          pinValue
        );
        localStorage.setItem('jiraCredentials', encrypted);
        // Remove any legacy plain-text keys
        localStorage.removeItem('jiraEmail');
        localStorage.removeItem('jiraToken');
        setHasEncryptedCreds(true);
        setHasLegacyCreds(false);
        closePinModal();
        showMessage('success', '✓ Credentials encrypted and saved.');

      } else if (pinModal === 'load') {
        const stored = localStorage.getItem('jiraCredentials');
        const creds = await decryptCredentials(stored, pinValue);
        setJiraEmail(creds.email);
        setJiraToken(creds.token);
        setEnableJira(true);
        closePinModal();
        showMessage('success', '✓ Credentials loaded.');

      } else if (pinModal === 'migrate') {
        // Encrypt the legacy plain-text creds with the new PIN
        const email = localStorage.getItem('jiraEmail');
        const token = localStorage.getItem('jiraToken');
        const encrypted = await encryptCredentials({ email, token }, pinValue);
        localStorage.setItem('jiraCredentials', encrypted);
        localStorage.removeItem('jiraEmail');
        localStorage.removeItem('jiraToken');
        setHasEncryptedCreds(true);
        setHasLegacyCreds(false);
        closePinModal();
        showMessage('success', '✓ Credentials secured with PIN.');
      }
    } catch {
      // AES-GCM throws on wrong PIN
      if (pinModal === 'load') {
        setPinError('Incorrect PIN. Please try again.');
      } else {
        setPinError('Encryption failed. Please try again.');
      }
      setPinLoading(false);
    }
  };

  const handleDeleteCredentials = () => {
    localStorage.removeItem('jiraCredentials');
    localStorage.removeItem('jiraEmail');
    localStorage.removeItem('jiraToken');
    setHasEncryptedCreds(false);
    setHasLegacyCreds(false);
    showMessage('success', '✓ Saved credentials deleted.');
  };

  const handleSaveCredentials = () => {
    if (!jiraEmail.trim() || !jiraToken.trim()) {
      showMessage('error', 'Please enter both email and token to save.');
      return;
    }
    openPinModal('save');
  };

  const updateSelectedIcon = (icon) => {
    setSelectedIcon(icon);
    if (icon) localStorage.setItem('pokerUserIcon', icon);
    else localStorage.removeItem('pokerUserIcon');
  };

  const updateSelectedGender = (gender) => {
    setSelectedGender(gender);
    if (gender) localStorage.setItem('pokerUserGender', gender);
    else localStorage.removeItem('pokerUserGender');
  };

  const createRoom = (e) => {
    e.preventDefault();

    if (!socketConnected) {
      setError('Not connected to server. Please wait or refresh.');
      return;
    }

    setIsLoading(true);

    const userName = e.target.userName.value.trim();
    const roomName = e.target.roomName.value.trim();

    if (!userName || !roomName) {
      setError('Please fill in all fields');
      setIsLoading(false);
      return;
    }

    localStorage.setItem('pokerUserName', userName);

    // Validate Jira credentials if enabled
    if (enableJira) {
      if (!jiraEmail.trim() || !jiraToken.trim()) {
        setError('Please provide Jira email and API token');
        setIsLoading(false);
        return;
      }

      // Basic email validation
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(jiraEmail.trim())) {
        setError('Please enter a valid email address');
        setIsLoading(false);
        return;
      }
    }

    // Validate custom scale if selected
    let cards;
    if (selectedScale === 'CUSTOM') {
      cards = customScaleInput.split(',').map(item => {
        const trimmed = item.trim();
        const num = Number(trimmed);
        return isNaN(num) ? trimmed : num;
      });

      if (cards.length === 0) {
        setError('Please enter at least one value for custom scale');
        setIsLoading(false);
        return;
      }
    } else {
      cards = ESTIMATION_SCALES[selectedScale].cards;
    }

    setUserNameState(userName);

    // Prepare room data
    const roomData = {
      userName,
      roomName,
      roomId: generatedRoomId,
      estimationScale: {
        type: selectedScale,
        cards: cards
      },
      ...(selectedIcon && { userIcon: selectedIcon })
    };

    // Add Jira credentials if enabled
    if (enableJira) {
      roomData.jiraEmail = jiraEmail.trim();
      roomData.jiraToken = jiraToken.trim();
    }

    socket.emit('create-room', roomData);
    setName(userName);
  };

  const regenerateRoomId = () => {
    const newRoomId = Math.random().toString(36).substring(2, 8).toUpperCase();
    setGeneratedRoomId(newRoomId);
    setRoomIdCopied(false);
  };

  const copyRoomIdToClipboard = () => {
    navigator.clipboard.writeText(generatedRoomId);
    setRoomIdCopied(true);
    setTimeout(() => setRoomIdCopied(false), 2000);
  };

  const handleScaleChange = (e) => {
    const scale = e.target.value;
    setSelectedScale(scale);
    setShowCustomScaleInput(scale === 'CUSTOM');

    if (scale === 'CUSTOM') {
      setCustomScaleInput('0, 1, 2, 3, 5, 8, 13, 21');
    }
  };

  const handleUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const resized = await resizeImage(file);
    updateSelectedIcon(resized);
    e.target.value = '';
  };

  return (
    <div className="create-room-page">
      <div className="create-room-container">
        <button className="back-button" onClick={() => navigate('/')}>
          <span className="back-icon">←</span> Back
        </button>

        <div className="create-room-header">
          <div className="header-icon">🎲</div>
          <h1 className="create-room-title">Create New Room</h1>
          <p className="create-room-subtitle">Set up your planning poker session</p>
        </div>

        {!socketConnected && (
          <div className="error-message">
            <span className="error-icon">⚠️</span>
            Connecting to server... Please wait.
          </div>
        )}

        {error && (
          <div className="error-message">
            <span className="error-icon">⚠️</span>
            {error}
          </div>
        )}

        {message.text && (
          <div className={`message ${message.type}`}>
            <span className="message-icon">{message.type === 'success' ? '✓' : '⚠️'}</span>
            {message.text}
          </div>
        )}

        {/* Legacy plain-text credentials migration notice */}
        {hasLegacyCreds && (
          <div className="legacy-credentials-notice">
            <div className="notice-header">⚠️ Unencrypted credentials detected</div>
            <div className="notice-body">
              Your Jira credentials are stored as plain text. Secure them with a PIN or delete them.
            </div>
            <div className="legacy-actions">
              <button className="btn-secure" onClick={() => openPinModal('migrate')}>
                <FaLock /> Secure with PIN
              </button>
              <button className="btn-delete" onClick={handleDeleteCredentials}>
                <FaTrash /> Delete
              </button>
            </div>
          </div>
        )}

        {/* Encrypted credentials found */}
        {hasEncryptedCreds && !hasLegacyCreds && (
          <div className="saved-credentials-prompt">
            <div className="prompt-content">
              <div className="prompt-icon"><FaLock /></div>
              <div className="prompt-text">
                <strong>Encrypted credentials found</strong>
                <p>Enter your PIN to load them.</p>
              </div>
              <div className="prompt-actions">
                <button className="btn-load" onClick={() => openPinModal('load')}>
                  Load & Enable
                </button>
                <button className="btn-delete" onClick={handleDeleteCredentials}>
                  <FaTrash /> Delete
                </button>
              </div>
            </div>
          </div>
        )}

        {/* PIN Modal */}
        {pinModal && (
          <div className="pin-modal-overlay" onClick={(e) => e.target === e.currentTarget && closePinModal()}>
            <div className="pin-modal">
              <div className="pin-modal-header">
                <div className="pin-modal-icon-wrap">
                  {pinModal === 'load' ? <FaLock /> : <FaLock />}
                </div>
                <h2 className="pin-modal-title">
                  {pinModal === 'load' ? 'Enter PIN' : 'Create PIN'}
                </h2>
                <p className="pin-modal-subtitle">
                  {pinModal === 'load'
                    ? 'Enter your PIN to decrypt and load your saved Jira credentials.'
                    : 'Choose a PIN to encrypt your Jira credentials. You\'ll need it each time you load them.'
                  }
                </p>
              </div>

              {pinError && <div className="pin-modal-error">⚠️ {pinError}</div>}

              <div className="pin-modal-field">
                <label>PIN</label>
                <input
                  type="password"
                  placeholder="Enter PIN"
                  value={pinValue}
                  onChange={(e) => setPinValue(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && !pinLoading && handlePinConfirm()}
                  autoFocus
                />
              </div>

              {(pinModal === 'save' || pinModal === 'migrate') && (
                <div className="pin-modal-field">
                  <label>Confirm PIN</label>
                  <input
                    type="password"
                    placeholder="Confirm PIN"
                    value={pinConfirm}
                    onChange={(e) => setPinConfirm(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && !pinLoading && handlePinConfirm()}
                  />
                </div>
              )}

              <div className="pin-modal-actions">
                <button className="pin-modal-cancel" onClick={closePinModal} disabled={pinLoading}>
                  Cancel
                </button>
                <button className="pin-modal-confirm" onClick={handlePinConfirm} disabled={pinLoading}>
                  {pinLoading ? 'Processing…' : pinModal === 'load' ? 'Unlock' : 'Encrypt & Save'}
                </button>
              </div>
            </div>
          </div>
        )}

        <form onSubmit={createRoom} className="create-room-form">
          <div className="form-group">
            <label htmlFor="userName" className="form-label">
              <span className="label-icon">👤</span>
              Your Name
            </label>
            <input
              id="userName"
              name="userName"
              type="text"
              placeholder="Enter your name"
              className="form-input"
              autoComplete="off"
              required
              maxLength={30}
              value={userNameState}
              onChange={(e) => { setUserNameState(e.target.value); localStorage.setItem('pokerUserName', e.target.value); }}
            />
            <div className="input-hint">This is how others will see you</div>
          </div>

          <div className="form-group">
            <label className="form-label">
              <span className="label-icon">🎨</span>
              Your Avatar <span className="optional-badge">Optional</span>
            </label>

            {/* Upload photo strip */}
            <div className="avatar-upload-strip">
              {selectedIcon?.startsWith('data:') ? (
                <div className="uploaded-avatar-preview">
                  <img src={selectedIcon} alt="Your photo" className="uploaded-avatar-img" />
                  <div className="uploaded-avatar-info">
                    <span>Your photo selected</span>
                    <button type="button" className="remove-upload-btn" onClick={() => updateSelectedIcon(null)}>
                      Remove
                    </button>
                  </div>
                </div>
              ) : (
                <button type="button" className="upload-photo-btn" onClick={() => fileInputRef.current?.click()}>
                  <span className="upload-photo-icon">📷</span>
                  <span>Upload a photo</span>
                </button>
              )}
              <input ref={fileInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleUpload} />
            </div>

            {/* Preset avatars (hidden when photo uploaded) */}
            {!selectedIcon?.startsWith('data:') && (
              <>
                <div className="avatar-section-divider"><span>or choose a preset</span></div>
                <div className="gender-selector">
                  {[
                    { key: 'male', label: '♂ Male' },
                    { key: 'female', label: '♀ Female' },
                    { key: 'other', label: '⚧ Other' },
                  ].map(({ key, label }) => (
                    <button
                      key={key}
                      type="button"
                      className={`gender-btn ${selectedGender === key ? 'selected' : ''}`}
                      onClick={() => { updateSelectedGender(key); updateSelectedIcon(null); }}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                {selectedGender && (
                  <div className="avatar-picker-grid">
                    <button
                      type="button"
                      className={`avatar-option avatar-none ${selectedIcon === null ? 'selected' : ''}`}
                      onClick={() => updateSelectedIcon(null)}
                      title="No avatar (use initials)"
                    >
                      <span>A</span>
                    </button>
                    {[
                      ...AVATAR_SEEDS[selectedGender].custom,
                      ...AVATAR_SEEDS[selectedGender].seeds.map(seed =>
                        getAvatarUrl(AVATAR_SEEDS[selectedGender].style, seed, AVATAR_SEEDS[selectedGender].params)
                      ),
                    ].map((url, i) => (
                      <button
                        key={url.slice(0, 60) + i}
                        type="button"
                        className={`avatar-option ${selectedIcon === url ? 'selected' : ''}`}
                        onClick={() => updateSelectedIcon(selectedIcon === url ? null : url)}
                      >
                        <img src={url} alt={`avatar-${i}`} loading="lazy" className="avatar-preset-img" />
                      </button>
                    ))}
                    {selectedGender === 'other' && EMOJI_AVATARS.map((emoji) => (
                      <button
                        key={emoji}
                        type="button"
                        className={`avatar-option avatar-emoji ${selectedIcon === emoji ? 'selected' : ''}`}
                        onClick={() => updateSelectedIcon(selectedIcon === emoji ? null : emoji)}
                        title={emoji}
                      >
                        <span className="avatar-emoji-icon">{emoji}</span>
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}

            <div className="input-hint">
              {selectedIcon?.startsWith('data:')
                ? 'Using your uploaded photo'
                : selectedGender
                  ? 'Pick an avatar to represent you'
                  : 'Upload a photo or choose a preset avatar'}
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="roomName" className="form-label">
              <span className="label-icon">📋</span>
              Room Name
            </label>
            <input
              id="roomName"
              name="roomName"
              type="text"
              placeholder="e.g., Sprint Planning, Feature Estimation"
              className="form-input"
              autoComplete="off"
              required
              maxLength={50}
            />
            <div className="input-hint">Give your session a descriptive name</div>
          </div>

          {/* Jira Integration Section */}
          <div className="form-group jira-integration-group">
            <label className="form-label">
              <span className="label-icon">🔌</span>
              Jira Integration (Optional)
            </label>
            <div className="jira-toggle">
              <label className="toggle-switch">
                <input
                  type="checkbox"
                  checked={enableJira}
                  onChange={(e) => setEnableJira(e.target.checked)}
                />
                <span className="toggle-slider"></span>
              </label>
              <span className="toggle-label">
                {enableJira ? 'Jira integration enabled' : 'Enable Jira integration'}
              </span>
            </div>
            <div className="input-hint">
              Enable to automatically update Jira issues after voting
            </div>

            {enableJira && (
              <div className="jira-credentials">
                <div className="credential-field">
                  <label htmlFor="jiraEmail" className="credential-label">
                    Jira Email Address
                  </label>
                  <input
                    id="jiraEmail"
                    type="email"
                    value={jiraEmail}
                    onChange={(e) => setJiraEmail(e.target.value)}
                    placeholder="your-email@company.com"
                    className="form-input"
                    required={enableJira}
                  />
                  <div className="input-hint">
                    Your Atlassian account email
                  </div>
                </div>

                <div className="credential-field">
                  <label htmlFor="jiraToken" className="credential-label">
                    API Token
                  </label>
                  <div className="token-input-wrapper">
                    <input
                      id="jiraToken"
                      type={showJiraToken ? "text" : "password"}
                      value={jiraToken}
                      onChange={(e) => setJiraToken(e.target.value)}
                      placeholder="Enter your API token"
                      className="form-input"
                      required={enableJira}
                    />
                    <button
                      type="button"
                      className="toggle-token-visibility"
                      onClick={() => setShowJiraToken(!showJiraToken)}
                    >
                      {showJiraToken ? <FaEyeSlash /> : <FaEye />}
                    </button>
                  </div>
                  <div className="input-hint">
                    <a
                      href="https://id.atlassian.com/manage-profile/security/api-tokens"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      How to get your API token
                    </a>
                  </div>
                </div>

                {/* Save Credentials Button */}
                <button
                  type="button"
                  className="save-credentials-btn"
                  onClick={handleSaveCredentials}
                  disabled={!jiraEmail.trim() || !jiraToken.trim()}
                >
                  <FaLock /> Encrypt & Save Credentials
                </button>
              </div>
            )}
          </div>

          {/* Estimation Scale Selection */}
          <div className="form-group">
            <label htmlFor="estimationScale" className="form-label">
              <span className="label-icon">📊</span>
              Estimation Scale
            </label>
            <select
              id="estimationScale"
              className="form-input"
              value={selectedScale}
              onChange={handleScaleChange}
            >
              {Object.entries(ESTIMATION_SCALES).map(([key, scale]) => (
                <option key={key} value={key}>
                  {scale.name} — {scale.description}
                </option>
              ))}
            </select>
            {selectedScale !== 'CUSTOM' && (
              <div className="scale-preview-inline">
                {ESTIMATION_SCALES[selectedScale].cards.slice(0, 8).map((card, i) => (
                  <span key={i} className="preview-card">{String(card)}</span>
                ))}
                {ESTIMATION_SCALES[selectedScale].cards.length > 8 && (
                  <span className="preview-more">+{ESTIMATION_SCALES[selectedScale].cards.length - 8} more</span>
                )}
              </div>
            )}
          </div>

          {/* Custom Scale Input */}
          {showCustomScaleInput && (
            <div className="form-group custom-scale-group">
              <label htmlFor="customScale" className="form-label">
                <span className="label-icon">✏️</span>
                Custom Values (comma-separated)
              </label>
              <input
                id="customScale"
                type="text"
                value={customScaleInput}
                onChange={(e) => setCustomScaleInput(e.target.value)}
                placeholder="e.g., 0, 1, 2, 3, 5, 8, 13, 21"
                className="form-input"
              />
              <div className="input-hint">Enter numbers or text values separated by commas</div>
            </div>
          )}

          <div className="room-id-section">
            <div className="room-id-label">
              <span className="label-icon">🔑</span>
              Room ID (auto-generated)
            </div>
            <div className="room-id-container">
              <div className="room-id-display">
                <span className="room-id-prefix">#</span>
                <span className="room-id-value">{generatedRoomId}</span>
              </div>
              <button
                type="button"
                className="copy-id-btn"
                onClick={copyRoomIdToClipboard}
                title="Copy room ID to clipboard"
              >
                {roomIdCopied ? <FaCopy className="copy-icon copied" /> : <FaRegCopy className="copy-icon" />}
              </button>
              <button
                type="button"
                className="regenerate-btn"
                onClick={regenerateRoomId}
                title="Generate new room ID"
              >
                <span className="regenerate-icon">↻</span>
              </button>
            </div>
            <div className="room-id-hint">
              <span className="hint-icon">ℹ️</span>
              Share this ID with others to join your session
            </div>
          </div>

          <div className="form-actions">
            <button
              type="submit"
              className="create-room-btn"
              disabled={isLoading || !socketConnected}
            >
              {isLoading ? (
                <>
                  <span className="loading-spinner"></span>
                  Creating Room...
                </>
              ) : !socketConnected ? (
                <>
                  <span className="loading-spinner"></span>
                  Connecting...
                </>
              ) : (
                <>
                  <span className="btn-icon">✨</span>
                  Create Room
                </>
              )}
            </button>
          </div>
        </form>

        <div className="create-room-features">
          <div className="feature-item">
            <span className="feature-icon">🔄</span>
            <div className="feature-text">
              <strong>Real-time voting</strong>
              <span>See votes as they come in</span>
            </div>
          </div>
          <div className="feature-item">
            <span className="feature-icon">📊</span>
            <div className="feature-text">
              <strong>Instant results</strong>
              <span>Reveal votes with one click</span>
            </div>
          </div>
          <div className="feature-item">
            <span className="feature-icon">📏</span>
            <div className="feature-text">
              <strong>Multiple scales</strong>
              <span>Fibonacci, T-shirts, and more</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}