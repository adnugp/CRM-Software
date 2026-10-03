import MultiDocumentUpload from './MultiDocumentUpload';
import type {DocumentFile} from '@/types';
export type {DocumentFile} from '@/types';
interface Props{document?:DocumentFile|null;onUpload:(doc:DocumentFile)=>void;onRemove:()=>void;readOnly?:boolean;recordCollection?:string;recordId?:string;}
export default function DocumentUpload({document,onUpload,onRemove,...props}:Props){return <MultiDocumentUpload {...props} documents={document?[document]:[]} onChange={docs=>docs.length?onUpload(docs[docs.length-1]):onRemove()}/>;}
