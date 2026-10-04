"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import type { PublicEventCardData } from "./public-event-card";
import { eventPresentation } from "@/lib/events/presentation";

function date(value:string){return new Intl.DateTimeFormat("en-GH",{dateStyle:"medium",timeZone:"Africa/Accra"}).format(new Date(value));}
export function PublishedEventsCarousel({events}:{events:PublicEventCardData[]}){
 const [index,setIndex]=useState(0); const [paused,setPaused]=useState(false);
 useEffect(()=>{if(paused||events.length<2)return;const id=window.setInterval(()=>setIndex(i=>(i+1)%events.length),5200);return()=>window.clearInterval(id)},[paused,events.length]);
 if(!events.length)return <section className="featured-events featured-events-empty"><div><p className="eyebrow">ON THE PLATFORM</p><h2>Great events are coming.</h2><p>Published awards and competitions will appear here when organizers are ready to welcome voters.</p></div><Link className="secondary-button" href="/sign-up">Create an event</Link></section>;
 const event=events[index]; const state=eventPresentation(event);
 return <section className="featured-events" aria-labelledby="featured-events-title" onMouseEnter={()=>setPaused(true)} onMouseLeave={()=>setPaused(false)} onFocus={()=>setPaused(true)} onBlur={e=>{if(!e.currentTarget.contains(e.relatedTarget))setPaused(false)}}>
   <div className="featured-events-heading"><div><p className="eyebrow">LIVE ON VOTECASTHUB</p><h2 id="featured-events-title">Events worth showing up for.</h2><p>Meet the nominees, understand the rules, and make your voice count.</p></div><div className="carousel-controls"><button type="button" aria-label="Previous event" onClick={()=>setIndex((index-1+events.length)%events.length)}>←</button><span aria-live="polite">{String(index+1).padStart(2,"0")} / {String(events.length).padStart(2,"0")}</span><button type="button" aria-label="Next event" onClick={()=>setIndex((index+1)%events.length)}>→</button></div></div>
   <div className="featured-event-stage"><article className="featured-event-card" key={event.id}><div className={`featured-event-image${event.imageUrl?" has-image":""}`} style={event.imageUrl?{backgroundImage:`url("${event.imageUrl}")`}:undefined} role={event.imageUrl?"img":undefined} aria-label={event.imageUrl?`${event.name} cover`:undefined}>{!event.imageUrl&&<span>V</span>}<span className="featured-event-status">{state.label}</span></div><div className="featured-event-copy"><span className="eyebrow">{event.voting_mode==="paid"?`GHS ${(event.unit_price_minor/100).toFixed(2)} PER VOTE`:"FREE VOTING"}</span><h3>{event.name}</h3><p>{event.description||"Explore the nominees and support the one who inspires you."}</p><div className="featured-event-date"><span>VOTING WINDOW</span><strong>{date(event.starts_at)} — {date(event.ends_at)}</strong></div><Link className="primary-link" href={`/events/${event.slug}`}>{state.key==="open"?"Vote now":"Explore event"} <span aria-hidden="true">↗</span></Link></div></article></div>
   <div className="carousel-dots" aria-label="Choose a featured event">{events.map((item,i)=><button type="button" key={item.id} aria-label={`Show ${item.name}`} aria-current={i===index} onClick={()=>setIndex(i)} />)}</div>
 </section>;
}
