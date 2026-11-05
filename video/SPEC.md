# SPEC: Daak explainer

GOAL:    a judge who has never heard of Daak can say, at the end, "every parcel handoff is proven and every driver is paid fairly, in rupees, without touching crypto".
OUTPUT:  HyperFrames, 1920 x 1080, 30 fps, on-screen lines, no voice (ETHGlobal bans AI voiceover).
TIME:    95 s x 30 = 2850 frames. Six scenes: then-now 0-8, breaks 8-26, reveal 26-30, journey 30-70, gains 70-88, claim 88-95.

LOOK:    the medium is a printed relay register: paper and stamped ink.
         - ground: paper #F7F3EA, flat, no gradient, 2% fibre noise drawn once as an SVG turbulence at 0.06 opacity;
         - ink #1F2A44: every line of text and every structural line (2.5 px route lines, 3 px object outlines);
         - green #2E7D4F: only "checked" and "paid" (stamps, ticks, the payout);
         - amber #B7791F: only "saved, held, waiting";
         - red #B23A3A: only the problem (torn edge, crossed-out rates) and nothing after the reveal;
         - display: Geist 640 weight, 78 px lines (7.2% of height), -2% tracking, left-aligned at x = 160; one line at a time;
         - labels: Geist Mono 500, 24 px, ink at 60%, sit next to the thing they name;
         - depth: objects that are pressable (phone, badge) cast 0 18px 40px rgba(31,42,68,0.14); everything printed sits flat.
OBJECTS: parcel = a brown cardboard box (#C9A06A face, #A9814F side, tape strip, handwritten code "KNP-7115", round NFC sticker);
         bus = a side view with five windows and a route board "KNP > LKO";
         rider (1540) = ink silhouette on a horse with a sealed pouch (red wax seal);
         phone = a rounded rectangle with the Daak app screen in its paper and ink;
         badge = a card with a photo square, name and NFC mark;
         stamp = a round rubber stamp, 3 px border, text on a circle, slightly rotated (-6 to 6 deg), printed in one frame with a 2-frame overshoot;
         map = the Grand Trunk Road as one ink line through Kanpur, Lucknow, Gorakhpur dots with names.
MOTION:  arrive on expo.out 0.5 s; camera moves power2.inOut 0.8 s; exits power3.in 0.25 s; stamps land in 4 frames (scale 1.35 to 1, back.out(2)); lines enter per word blur 6 px to 0, 0.07 s apart, then hold dead still; numbers count up over 0.6 s.
SHOTS:   see SCRIPT.md for the lines; each line holds 0.5 s + 0.3 s a word at least.
         01 0-4 rider passes a sealed pouch along the GT road | line 1
         02 4-8 match cut: the wax seal becomes the parcel's NFC sticker, the horse becomes a bus | line 2
         03 8-11.5 map: two buses, two drivers, a dashed gap where a receipt should be | line 3
         04 11.5-14.5 torn parcel, three arrows pointing at each other | line 4
         05 14.5-18 three rate quotes Rs 150, Rs 220, Rs 90 for the same route, struck in red | line 5
         06 18-22 cash notes and an empty register page | line 6
         07 22-26 three doors (loan, savings, grow) printed with a red bar | line 7
         08 26-30 the word Daak stamped big, line 8 under it
         09 30-34.5 booking slip: meter Rs 5 + Rs 0.50 x 350 km = Rs 180, a "402" stamp turns to "PAID" | line 9
         10 34.5-39 escrow box, Rs 180 splits into 80 km and 270 km bars | line 10
         11 39-44 phone: parcel tap, badge tap, lid photo frame, GPS pin | line 11
         12 44-48.5 check card: right parcel, right stop, still sealed tick green; label 0G TeeML | line 12
         13 48.5-53 three stamps: Hedera, Arkiv, map pin | line 13
         14 53-58 highway, signal bars fall, amber "Saved. Payment held." | line 14
         15 58-62.5 Gorakhpur, tracking page on the shop's phone shows Delivered | line 15
         16 62.5-66.5 payout: Rs 41 and Rs 139 count up green; label 2% by the token's fee rule | line 16
         17 66.5-70 UPI notification "Rs 40.31 received" on the driver's phone | line 17
         18 70-76 Bachat pot fills with 5% | line 18
         19 76-82 work card: 64 deliveries, 9,800 km, 98% clean (illustrative, a month of work) -> fuel advance Rs 2,000 | line 19
         20 82-88 a shop browses driver cards sorted by record and picks one | line 20
         21 88-95 line 21, then the Daak mark stamped and held 2.5 s
BANNED:  the dark void; glow and particles; serif display and italic accent words; small monospace caps labels as decoration; pills; three cards in a row; everything centred; every element fading and sliding up; titles that move after they land; the logo docked in a corner; crypto imagery (coins with B, chains, wallets).
QA:      frames 2, 6, 13, 25, 28, 33, 41, 47, 51, 56, 64, 68, 74, 80, 86, 93 each show one readable line and its object at least 40% of the frame.
