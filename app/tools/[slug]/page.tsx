import ToolRunner from "./ToolRunner";
export default async function ToolPage({params}:{params:Promise<{slug:string}>}){const {slug}=await params;return <ToolRunner slug={slug}/>;}