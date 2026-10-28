/** Grab event information from page, return as list of objects */
function GetEvents() {
    try {
        let events = []
        let event_date_elements = document.querySelectorAll(".ess-events-list.upcoming-list > ol > li")
        console.log("got event date elements:", event_date_elements)

        if (event_date_elements.length == 0) {
            alert("Error: Unable to download calendar. No events found on page")
            return []
        }

        for (let date_element of event_date_elements) {
            console.log(`Checking ${date_element.querySelector("time.group-date .group-date-number").innerText} ${date_element.querySelector("h3.group-month").innerText}`) // eg. 25 September, 2025
            // Collect day and month info from elements
            let start_day = date_element.querySelector("time.group-date .group-date-number").innerText // eg. 25
            let group_month = date_element.querySelector("h3.group-month").innerText // eg. September, 2025
            group_month = group_month.split(", ")
            event_month = new Date(Date.parse(group_month + " 1, 2000")).getMonth()
            event_year = group_month[1]
            
            // Create events for each valid element
            for (let element of date_element.querySelectorAll(".event-item")) {
                let event = {}

                // Make sure this is actually a shift event
                let transfer_check = element.querySelector(".transfershift-event-template")
                let shift_check = element.querySelector(".shift-event-template")
                let timeoff_check = element.querySelector(".timeoff-period-event")

                if ((timeoff_check || !transfer_check && !shift_check) || (shift_check && shift_check.innerText.trim() == "Open Shift")) {
                    continue
                }

                // If shift is valid, create new blank Date
                console.log(`Found shift in:`, element)
                let start_date = new Date(year=2000, monthIndex=0, date=1, hours=0, minutes=0, seconds=0, ms=0)

                // Set date related info that was collected earlier
                start_date.setFullYear(event_year)
                start_date.setMonth(event_month)
                start_date.setDate(start_day)

                // Hourly times
                let time_span = element.querySelector(".group-events .event-title time").innerText.trim() // eg. 10:00 AM - 4:00 PM

                // Starting time
                let start_time = time_span.split(" - ")[0] // eg. 10:00 AM
                start_date.setHours(parseInt(start_time.split(":")[0]))
                start_date.setMinutes(parseInt(start_time.split(":")[1].split(" ")[0]))
                if (start_time.endsWith("PM") && start_date.getHours() != 12) {
                    start_date.setHours(start_date.getHours()+12)
                    console.log("Shift starts in PM, adding 12 to start_date hours")
                }
                event["start_date"] = start_date
                console.log("EVENT START DATE:", start_date)

                // Ending time
                let end_date = new Date(start_date.getFullYear(), start_date.getMonth(), start_date.getDate(), start_date.getHours(), start_date.getMinutes(), seconds=0, ms=0)
                let shift_len = element.querySelector(".group-events .event-title time").nextElementSibling.innerText
                shift_len = shift_len.substring(1, shift_len.length-1)
                let shift_minutes = parseInt(shift_len.split(":")[1])
                let shift_hours = parseInt(shift_len.split(":")[0])
                end_date.setMinutes(end_date.getMinutes() + shift_minutes)
                end_date.setHours(end_date.getHours() + shift_hours)
                event["end_date"] = end_date
                console.log("EVENT END DATE:", end_date)

                // Name
                let segments = element.querySelectorAll("ol.event-segments .segment-details .segment-detail-location") // eg. Kwik Trip Inc./Retail/Z0002/D0015/00887/Admin/LMS
                let name = ""
                for (let s of segments) {
                    s = s.title.split("/")
                    console.log(`Parsing 3rd from last of ${s} (${s[s.length-3]}) into number: ${Number.parseInt(s[s.length-3])}`);
                    let store = Number.parseInt(s[s.length-3]) // eg. 887
                    let job = s[s.length-1] // eg. Guest Service
                    name += `${store} (${job}), `
                }
                name = name.slice(0, name.length-2) // remove trailing comma
                event["name"] = name

                // Description/comments, if any
                let comment_elements = element.querySelectorAll("comments-and-notes span.comment") // eg. NEW HIRE TRAINING front end
                let comments = ""
                if (segments.length > 1) {for (let s of segments) {
                    let job = s.title.split("/")
                    let time = s.parentElement.querySelector("time").innerText
                    comments += `${job[job.length-1]}: ${time}\\n`
                }}
                for (let c of comment_elements) {comments += `${c.querySelector("strong").innerText}: ${c.querySelector("span").innerText}, `}
                comments = comments.slice(0, comments.length-2)
                if (comments.length > 0) {event["comments"] = comments}

                // Add to events list
                events.push(event)
                console.log("Added event:", event)
            }
        }

        return events
    }
    catch (e) {
        console.error(e)
        alert(e)
        return ""
    }
}


/** Create text for a calendar with the list of given events.
 * 
 * All events should be JSON with the following fields:
 * - name (str)
 * - start_date (Date)
 * - end_date (Date)
 * - comments (str - Optional)
 */
function MakeCalText(events) {
    // Start calendar
    let caltext = "BEGIN:VCALENDAR\nPRODID:-//Google Inc//Google Calendar 70.9054//EN\nVERSION:2.0\nCALSCALE:GREGORIAN\nMETHOD:PUBLISH\nX-WR-CALNAME:Work\nX-WR-TIMEZONE:America/Chicago\nX-WR-CALDESC:Kwik Trip work schedule\n"

    // Helper for making valid timestamps
    const makeDateText = (date) => {
        let date_text = String(date.getUTCFullYear())
        date_text += String(date.getUTCMonth()+1).padStart(2, "0")
        date_text += String(date.getUTCDate()).padStart(2, "0")
        date_text += `T`
        date_text += String(date.getUTCHours()).padStart(2, "0")
        date_text += String(date.getUTCMinutes()).padStart(2, "0")
        date_text += `00Z`
        return date_text
    }

    // Add info for each event
    for (let event of events) {
        let start_text = makeDateText(event["start_date"])
        let end_text = makeDateText(event["end_date"])
        let now_text = makeDateText(new Date())

        caltext += `\nBEGIN:VEVENT\n`
        caltext += `DTSTART:${start_text}\n`
        caltext += `DTEND:${end_text}\n`
        caltext += `DTSTAMP:${start_text}\n`
        caltext += `UID:KT${start_text}@google.com\n`
        caltext += `CREATED:${now_text}\n`
        if ("comments" in event) {caltext += `DESCRIPTION:${event["comments"]}\n`}
        caltext += `LAST-MODIFIED:${now_text}\n`
        caltext += `SEQUENCE:0\n`
        caltext += `STATUS:CONFIRMED\n`
        caltext += `SUMMARY:KT ${event["name"]}\n`
        caltext += `TRANSP:OPAQUE\n`
        caltext += `END:VEVENT\n`
    }

    // End calendar
    caltext += "\nEND:VCALENDAR"
    return caltext
}


/** Download helper function */
function download(text) {
    var element = document.createElement('a');
    element.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(text));
    let caldate = document.querySelector("employee-view-date-display > span").innerText;
    element.setAttribute('download', `Work Calendar ${caldate}.ics`);

    element.style.display = 'none';
    document.body.appendChild(element);

    element.click();

    document.body.removeChild(element);
}


/** Adds download button whenever parent is available */
async function addButtonWhenReady(dl_button){
    if (!document.getElementById("html.schedule.toolbar.view")){
        setTimeout(() => {addButtonWhenReady(dl_button)}, 100);
    } else {
        console.log("Adding button to parent:", document.getElementById("html.schedule.toolbar.view"))
        document.getElementById("html.schedule.toolbar.view").appendChild(dl_button);
    }
}


/** Document ready */
document.addEventListener("readystatechange", () => {
    if (document.readyState == "complete") {
        const dl_button = document.createElement("button");
        dl_button.id = "dl-button"
        dl_button.innerText = "Download ICS";
        let cssText = `
        #dl-button {
            background: var(--zed_sys_color_action_enabled);
            border: none;
            border-radius: 3px;
            color: var(--zed_sys_color_background);
            font-weight: bold;
            font-size: 1.1em;
            padding: 0.15em 0.5em;
            margin: 1em;
        }
        #dl-button:hover {
            background: var(--zed_sys_color_action_hover)
        }`
        var style = document.createElement('style');

        if (style.styleSheet) {
            style.styleSheet.cssText = cssText;
        } else {
            style.appendChild(document.createTextNode(cssText));
        }
        document.getElementsByTagName('head')[0].appendChild(style);

        dl_button.addEventListener("click", function () {
            let events = GetEvents()
            console.log("Events list:", events)

            if (events.length > 0) {
                let caltext = MakeCalText(events)
                download(caltext)
            }
        })
        addButtonWhenReady(dl_button);
    }
})