import { TicketView } from '@/features/public/ticket_view';
export default async function Page({params,searchParams}:{params:Promise<{ticket_code:string}>;searchParams:Promise<{token?:string}>}){const [route,query]=await Promise.all([params,searchParams]);return <TicketView ticket_code={route.ticket_code} token={query.token??''}/>}
