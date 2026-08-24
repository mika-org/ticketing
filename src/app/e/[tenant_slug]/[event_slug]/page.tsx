import { EventLanding } from '@/features/public/event_landing';
export default async function Page({params}:{params:Promise<{tenant_slug:string;event_slug:string}>}){const value=await params;return <EventLanding {...value}/>}
