-- Activate only the implemented, privacy-conscious public-source tools.
insert into public.tools(slug,name,description,category,credit_cost,enabled)
values
 ('username-tracker','Username Tracker','Build direct links to public profile pages without scraping accounts.','Public profiles',1,true),
 ('dns-lookup','DNS Lookup','Query public A, AAAA, MX, NS and TXT DNS records.','Network',1,true),
 ('domain-lookup','Domain Analyzer','Retrieve public domain registration and nameserver information.','Web intelligence',1,true),
 ('email-validator','Email Validator','Validate syntax and inspect public MX records only.','Validation',1,true),
 ('ip-lookup','IP Lookup','Show approximate public network metadata for public IP addresses.','Network',1,true),
 ('url-safety','Website Analyzer','Inspect URL structure and public DNS records.','Web intelligence',1,true),
 ('reverse-image-search','Reverse Image Search','Open third-party public image search engines for an image URL.','Media',1,true),
 ('social-media-analyzer','Social Media Analyzer','Generate public profile links for a supplied username.','Public profiles',1,true),
 ('breach-self-check','Breach Self-Check','Open the official Have I Been Pwned self-check page.','Account safety',1,true)
on conflict(slug) do update set
 name=excluded.name, description=excluded.description, category=excluded.category, enabled=true;

-- Do not activate unsupported phone-number identity or number-lookup tools.
update public.tools set enabled=false
where slug in ('phone-validator','number-info','image-metadata');
