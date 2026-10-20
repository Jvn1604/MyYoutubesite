# DePhantom OBS overlay

Custom stream overlay in the channel's colours: five scenes, a live control panel, and StreamElements alerts + chat styled to match.

Everything moves: neon light travels around every panel and the webcam frame, text decodes in like a hacker screen, particles drift behind the full-screen scenes under a rotating sigil, lightning flashes now and then, the countdown digits roll and the screen pulses in the last 10 seconds, and new subscribers set off a spark burst with a floating “+1” on the goal bar. Turn it all off with **Colours → Animations** in the control panel.

| Scene | What's on it |
|---|---|
| **Starting Soon** | Animated background, countdown, today's game, socials, rotating info |
| **Be Right Back** | Same look; countdown ("Back in…") or animated dots |
| **Ending** | Thank-you message, next stream time, socials |
| **In-game** | Webcam frame, LIVE name plate, now playing, sub goal bar, ticker. Webcam can go in any corner |
| **Just Chatting** | Big webcam, chat panel, stream title + topic, socials, sub goal |
| **Alerts** *(StreamElements)* | New subscriber, member, gifted memberships, Super Chat, tip |
| **Chat** *(StreamElements)* | YouTube chat with Host / Mod / Member colours, hides bots and `!commands` |

---

## 1. Start the overlay (every time you stream)

Double-click **`overlay/start-overlay.bat`**. A black window opens. Keep it open while streaming. You can also start it from a terminal in the project folder:

```bash
npm run overlay
```

Then open the control panel in your browser: **http://localhost:7777/control**

> Start the overlay **before** opening OBS. If you start it after, right-click each browser source → **Refresh**.

## 2. Add the scenes to OBS (one time)

For each scene: **Sources → + → Browser**, then:

- **URL**: copy it from the control panel's *OBS browser sources* box (click a row to copy)
- **Width** `1920`, **Height** `1080`
- Untick **Shutdown source when not visible**, so countdowns and animations keep running
- Leave **Custom CSS** empty (delete the default text in it)

| OBS scene | Browser source URL | Put underneath |
|---|---|---|
| Starting Soon | `http://localhost:7777/scenes/screen.html?mode=starting` | nothing (it's full screen) |
| BRB | `http://localhost:7777/scenes/screen.html?mode=brb` | nothing |
| Ending | `http://localhost:7777/scenes/screen.html?mode=ending` | nothing |
| In-game | `http://localhost:7777/scenes/ingame.html` | Game capture, then webcam |
| Just Chatting | `http://localhost:7777/scenes/chatting.html` | Webcam |

The overlay source must be **above** the game and webcam in the Sources list.

### Webcam position

Right-click the webcam source → **Transform → Edit Transform**, and set:

| Scene | Position | Size |
|---|---|---|
| In-game, top right (default) | X `1400`, Y `40` | `480 × 270` |
| In-game, top left | X `40`, Y `40` | `480 × 270` |
| In-game, bottom right | X `1400`, Y `770` | `480 × 270` |
| In-game, bottom left | X `40`, Y `770` | `480 × 270` |
| Just Chatting | X `48`, Y `48` | `1280 × 720` |

The control panel shows the right numbers for the corner you've picked. For a webcam that isn't 16:9, use **Crop** in the same window rather than stretching.

### Control panel as an OBS dock (recommended)

**Docks → Custom Browser Docks**, name it `Overlay`, URL `http://localhost:7777/control`. Now you can change the game, start a countdown or bump the sub count without leaving OBS.

## 3. Alerts and chat (StreamElements, one time)

1. Sign in at [streamelements.com](https://streamelements.com) with your YouTube account.
2. **Streaming tools → Overlays → New overlay**, size 1920 × 1080.
3. **+ → Static / Custom → Custom widget**. Click **Open editor** and paste each file into its tab:

   | Editor tab | Alerts widget | Chat widget |
   |---|---|---|
   | HTML | `streamelements/alerts/widget.html` | `streamelements/chat/widget.html` |
   | CSS | `streamelements/alerts/widget.css` | `streamelements/chat/widget.css` |
   | JS | `streamelements/alerts/widget.js` | `streamelements/chat/widget.js` |
   | Fields | `streamelements/alerts/fields.json` | `streamelements/chat/fields.json` |
   | Data | leave as `{}` | leave as `{}` |

   Click **Done**.
4. Size and place the widgets on the StreamElements canvas:
   - **Alerts**: about 1000 × 360, top centre (or anywhere the game HUD is empty).
   - **Chat**: in the Just Chatting scene, X `1376`, Y `104`, size `496 × 716`, so it sits inside the chat panel.
5. Use the **Test** buttons in the widget settings on the left to try each alert. Add sounds under each alert type.
6. **Save**, copy the overlay URL (the 🔗 button) and add it to OBS as another Browser source (1920 × 1080), above the scene overlay. For chat, make a separate StreamElements overlay with just the chat widget and add it only to the Just Chatting scene.

> Preview both widgets locally (fake events, no StreamElements needed):
> `http://localhost:7777/streamelements/preview.html?widget=alerts` and `?widget=chat`.
> After editing a widget file, paste it into StreamElements again.

## 4. During a stream

| You want to… | In the control panel |
|---|---|
| Start a "Starting Soon" countdown | **Countdown** → 5 / 10 / 15 min |
| Change game | **Stream → Current game** (the in-game chip pops when it changes) |
| Count a new subscriber | **Subscriber goal → +1 sub** |
| Change the ticker | **Ticker messages**, one per line |
| Move the webcam corner | **Layout → Webcam corner** (then move the webcam source in OBS) |
| Change colours | **Colours** → pick or click a preset |
| Turn off animations | **Colours → Animations** |

Changes appear on stream instantly and are saved in `overlay/state.json`, so they're still there next time. **Reset everything to defaults** restores `overlay/state.default.json`.

### Automatic subscriber count

Once the website is live, tick **Read subscriber count from my website** and set **Website URL** to your site's address. The overlay reads the count from the site every 5 minutes. Until then, use the +1 button.

## Customising further

| Change | File |
|---|---|
| Shared colours, panels, goal bar, webcam frame | `shared/overlay.css` |
| Particles, text decode, sparks, lightning timing | `shared/fx.js` |
| Starting / BRB / Ending layout and background | `scenes/screen.html` |
| In-game layout | `scenes/ingame.html` |
| Just Chatting layout | `scenes/chatting.html` |
| Default text and settings | `state.default.json` |
| Alert / chat look | `streamelements/*/widget.css` |

Add `?bg` to any scene URL to preview it over a fake game background in a normal browser (for example `http://localhost:7777/scenes/ingame.html?bg`). OBS refreshes a source with right-click → **Refresh**.

## Troubleshooting

| Problem | Fix |
|---|---|
| Browser source is blank | The overlay window isn't running. Start `start-overlay.bat`, then right-click the source → **Refresh** |
| `EADDRINUSE` when starting | It's already running in another window. Close the duplicate |
| Fonts look different | Run `npm install` once in the project folder (fonts come from `node_modules`) |
| Webcam shows outside the frame | Check the webcam's Transform numbers (section 2) |
| Alerts don't show | Use the Test buttons in StreamElements; make sure the StreamElements source is above the scene overlay in OBS |
| Use a different port | `set OVERLAY_PORT=7788` before starting, and update the URLs in OBS |
