-- Only for an OLD database that still has the built-in demo tools. Not needed on a fresh project.
delete from public.tools where slug in ('ip-lookup','domain-lookup','dns-lookup','email-validator','phone-validator','url-safety','image-metadata');
-- Old tool API configs lived in site_settings and were publicly readable. Move them with the admin Tools page, then drop them:
-- delete from public.site_settings where key like 'tool_api_%';
