Operations Management
2 .1 Role:
Super Admin (common for Lead and Operations management) – hence no
action required. Q: can 2 users be assigned this role?
Operations Head
Team Lead
Recruiter
2 .2 Role hierarchy:
Super Admin → Operations Head →Team Lead → Recruiter
2 .3 Authorization:
Super Admin – common for both, hence no action required
Operations Head - Role assignment/removal, Client
create/assign/delete/update/status change/comment, Position
create/assign/delete/update/status change/comment, Task/Reminder
create/edit/close, Operations Dashboard visibility, Operations Report
download, Mass upload of legacy data
Team Lead – Client create/assign/update/status change/comment, Position
create/assign/update/status change/comment, Task/Reminder
create/edit/close, Operations Dashboard visibility (limited to own and team),
Operations Report download (limited to own and team)
Recruiter - Position update/status change/comment, Task/Reminder
create/edit/close, Operations Dashboard visibility (limited to own),
Operations Report download (limited to own)
4 Object and Dataset:
a) Client –
Company name (text)
Address – 1 st line (text mandatory), 2nd line (text), 3rd line (text), City
(text mandatory), State/UT (dropdown mandatory), PIN (numeric 8-digit
mandatory), Country (dropdown mandatory)
GSTIN (alphanumeric mandatory)
Location type – Office/Plant (Boolean)
Contact person (text) – we want to maintain multiple contact person for
every client. Need an interface to add as many record as we want.
Designation (text) – same as no.
Email (text) – same as no.2 Q: is it possible to keep a validation logic?,
e.g., @......com must be there?
Mobile (numeric) – same as no.
9) Assigned to (User – TL/Recruiter)
10) Agreement date (date)
11) Agreement valid till (date) Q: Can we get a reminder if this date is 30
days away?
12) Remarks (text)
b) Position JD –
Assigned user to upload the JD as an attachment (PDF / DOC / DOCX etc.).
System to convert PDF into DOC/DOCX format and vice versa. Both
version to remain in database and accessible to assigned user and higher
up.
c) Candidate –
Assigned user to upload the CV as an attachment (PDF / DOC /DOCX
etc.). System to convert PDF into DOC/DOCX format and vice versa. Both
versions to remain in database and accessible to assigned user and higher
up. Also the uploaded document to be pursed to extract the following
data.
1) Name (text)
2) Qualification (dropdown)
3) Total experience in years (numeric)
4) Email (text) Q: is it possible to keep a validation logic?, e.g., @......com
must be there?
5) Mobile and Alternative mobile number (both numeric 10 digit). Need
Country Code field (dropdown) before number.
6) Current/Last organization (text)
7) Current/Last CTC in INR (numeric)
8) Notice period in days (numeric. Allow 0)
d) Reminder/Task – any user can assign Task to any user
1) Related to (Position)
2) Assigned to (User name + Role)
3) Due date (date)
4) Action (dropdown – tentative values: New, In-process, Hold, Closed)
2 .5 Object hierarchy : Client → Position → Candidate

2.6 Operations Pipeline (Position):

New
Work-in-progress
Closed
7 Intimation: For any update – status change, comment, assign/reassign, system
should send intimation to higher up within Tool.
Exmpl. Recruiter has added a candidate profile to a position and put some comment
in the position. Team Lead (1-level up), Operations Head (2-level up) and Super
Admin ( 3 - levels up) shall get intimation of the comment.

8 Mailing: Mail to candidate and Client company representative directly from this
tool in pre-defined template.
Mail attachment –
Option to attach documents, e.g., JD, Resume etc. in WORD and PDF format.
Option to remove budgeted CTC or budgeted Compensation from JD.
Option to remove Email, Phone/Mobile No. from Resume.
Option to add text “ Profile sourced by Ken McCoy Consulting ” in header or footer
section of resume.

9 Report export: Report export in Excel. Report to contain Client, Position and
Candidate details. Combined master report with all related data and separate report
for Client, Position, Candidate.