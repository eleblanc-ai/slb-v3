# Batch Lesson Creation Guide

This guide walks through how to create multiple lessons at once using the batch upload feature.

## Overview

Instead of creating lessons one at a time, you can prepare a markdown file with content for up to **30 lessons** and upload them all at once. The system will import your content, let you review it, and then use AI to generate the remaining fields.

## Step 1: Download a Markdown Template

Before writing your markdown file, download a template so you know exactly what fields are available.

1. Go to **Create a New Lesson** from the home page
2. On each template card, click the **download icon** (next to the "Create Lesson" button)
3. A `.md` file will download with all the field names and hints for that template

`[SCREENSHOT: Template card with download button highlighted]`

The downloaded file will look something like this:

```
#Template Name
Additional Reading Practice

#Selection
[Enter value]

#Grade Band
[Choose one: Pre-K, K, 1, 2, 3, 3–5, 6–8, 9–10, 11–12]

#Theme
[Choose one: Science & Technology, History, ...]

#Subjects
[One item per line. Options: Science, ELA, Social Studies, ...]

#Headline
[Enter value]

#Passage
[Enter text or HTML content]

#Lexile Level
[Enter value]

#Author
[Enter value]

...
```

## Step 2: Fill In Your Content

Open the downloaded `.md` file in any text editor and replace the placeholder hints with your actual content.

**Key rules:**
- Keep the `#Field Name` headers exactly as they are
- Put your content on the line(s) below each header
- For **dropdown fields** (Grade Band, Theme, etc.), use one of the exact values listed in the hint
- For **checklists** (like Subjects), put one item per line
- For **standards**, separate codes with semicolons: `CCSS.RI.7.1; CCSS.RI.7.2`
- Leave out any fields you don't have information for

### Multiple Lessons in One File

To include multiple lessons, separate them with `---` on its own line:

```
#Template Name
Additional Reading Practice

#Selection
The Science of Sleep

#Grade Band
6-8

#Theme
Science & Technology

#Headline
Why Sleep Is Your Brain's Best Friend

#Passage
Every night, when you close your eyes and drift off to sleep,
your brain gets to work...

---

#Template Name
Additional Reading Practice

#Selection
Water is Life

#Grade Band
6-8

#Theme
Science & Technology

#Headline
The Global Water Crisis

#Passage
More than two billion people around the world lack access
to safe drinking water...
```

**Important:** Each lesson must start with `#Template Name` followed by the exact name of the template (e.g., "Additional Reading Practice", "Applied Lesson"). You can mix different template types in the same file.

## Step 3: Upload Your File

1. From the **Create a New Lesson** page, click **Batch Create from Markdown**

`[SCREENSHOT: Header with "Batch Create from Markdown" button]`

2. Drag and drop your `.md` file into the upload area, or click to browse

`[SCREENSHOT: Upload modal with drop zone]`

3. The system will parse your file and show you what it found:
   - A green checkmark for each lesson whose template was recognized
   - The number of fields detected in each lesson
   - Any errors (e.g., template name not found)

`[SCREENSHOT: Parsed results showing lesson cards with green checks]`

4. Choose an AI model if you want to change from the default, then click **Review Imports**

## Step 4: Review & Edit

Before the AI starts generating, you get a chance to review and edit everything.

`[SCREENSHOT: Review step showing expanded lesson with fields]`

Each lesson appears as an expandable card showing:

- **Imported fields** -- the content from your markdown, editable if you need to make changes
- **Missing required fields** (red) -- fields that are required but weren't in your markdown. Fill these in before continuing.
- **AI-generated fields** (blue) -- fields that the AI will fill in based on your content (like comprehension questions, glossary entries, etc.)
- **Not in markdown** (yellow) -- optional fields that weren't in your file. These are fine to skip.

Once all required fields are filled in, click **Start Batch Creation**.

## Step 5: Watch the Progress

The system processes each lesson one at a time. You'll see:

- A progress bar showing overall completion
- Per-lesson status (Waiting, In Progress, Complete)
- The specific field being generated for the current lesson
- A thumbnail preview of the cover image once it's generated

`[SCREENSHOT: Progress modal showing lessons being processed]`

You can click **Cancel After Current Lesson** if you need to stop early -- lessons already completed will be saved.

When everything is done, click **Done** to return to the lesson browser. Each completed lesson will have an **Open in Lesson Editor** link if you want to review or edit it right away.

`[SCREENSHOT: Completed batch with "Open in Lesson Editor" links]`

## Tips

- **Start small.** Try a single lesson first to make sure the format is right, then scale up to 5.
- **Use the downloaded template.** It ensures you have the right field names and shows what options are available for dropdowns.
- **Check your template names.** The `#Template Name` value must exactly match one of the templates in the system (it's not case-sensitive, but spelling matters).
- **Required fields matter.** If a field is required for generation, the AI needs it to produce good results. The review step will flag anything that's missing.
- **You can mix templates.** One file can contain lessons for different template types -- just make sure each lesson has the correct `#Template Name`.
