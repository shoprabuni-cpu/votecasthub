"use client";
import { useEffect } from "react";
export function EventViewTracker({eventId}:{eventId:string}){useEffect(()=>{const key=`vch-visitor:${eventId}`;let hash=localStorage.getItem(key);if(!hash){hash=crypto.randomUUID()+crypto.randomUUID();localStorage.setItem(key,hash)}void fetch("/api/analytics/event-view",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({eventId,visitorHash:hash})});},[eventId]);return null}
