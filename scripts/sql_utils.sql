-- Import de la foreign table geotrek.core_path depuis le serveur geotrek admin : adminrando.marittimemercantour.eu (au préalable, il faut créer le serveur foreign data wrapper srv_geotrek
-- et l'utilisateur geotrek_fdw_user sur la base de données geotrek ainsi qu'un user mapping pour l'utilisateur geotrek_fdw_user sur le serveur foreign data wrapper srv_geotrek)

CREATE FOREIGN TABLE geotrek.core_path (
	id int4 OPTIONS(column_name 'id') NOT NULL,
	structure_id int4 OPTIONS(column_name 'structure_id') NOT NULL,
	"valid" bool OPTIONS(column_name 'valid') NOT NULL,
	"name" varchar(250) OPTIONS(column_name 'name') NULL,
	"comments" text OPTIONS(column_name 'comments') NULL,
	date_insert timestamptz OPTIONS(column_name 'date_insert') NOT NULL,
	date_update timestamptz OPTIONS(column_name 'date_update') NOT NULL,
	length float8 OPTIONS(column_name 'length') NULL,
	ascent int4 OPTIONS(column_name 'ascent') NULL,
	descent int4 OPTIONS(column_name 'descent') NULL,
	min_elevation int4 OPTIONS(column_name 'min_elevation') NULL,
	max_elevation int4 OPTIONS(column_name 'max_elevation') NULL,
	source_id int4 OPTIONS(column_name 'source_id') NULL,
	stake_id int4 OPTIONS(column_name 'stake_id') NULL,
	geom_3d public.geometry(geometryz, 32632) OPTIONS(column_name 'geom_3d') NULL,
	geom_cadastre public.geometry(linestring, 32632) OPTIONS(column_name 'geom_cadastre') NULL,
	departure varchar(250) OPTIONS(column_name 'departure') NULL,
	arrival varchar(250) OPTIONS(column_name 'arrival') NULL,
	comfort_id int4 OPTIONS(column_name 'comfort_id') NULL,
	slope float8 OPTIONS(column_name 'slope') NULL,
	geom public.geometry(linestring, 32632) OPTIONS(column_name 'geom') NOT NULL,
	visible bool OPTIONS(column_name 'visible') NOT NULL,
	eid varchar(1024) OPTIONS(column_name 'eid') NOT NULL,
	draft bool OPTIONS(column_name 'draft') NOT NULL,
	"uuid" uuid OPTIONS(column_name 'uuid') NOT NULL,
	"source" int4 OPTIONS(column_name 'source') NULL,
	"target" int4 OPTIONS(column_name 'target') NULL,
	provider_id int4 OPTIONS(column_name 'provider_id') NULL,
	length_2d float8 OPTIONS(column_name 'length_2d') GENERATED ALWAYS AS (round(st_lengthspheroid(st_transform(geom, 4326), 'SPHEROID("GRS_1980",6378137,298.257222101)'::spheroid)::numeric(1000,15), 2)) STORED NULL
)
SERVER srv_geotrek
OPTIONS (schema_name 'public', table_name 'core_path');




-- Fonction qui permet de récupérer les tronçons geotrek depuis le fdw de manière sécurisée, en utilisant n'importe quel utilisateur, même si celui-ci n'a pas les droits sur la table geotrek.core_path. Cette fonction est utilisée dans la vue sentier.troncons_geotrek.

CREATE OR REPLACE FUNCTION geotrek.get_core_path_secured()
 RETURNS TABLE(id integer, structure_id integer, valid boolean, name character varying, comments text, date_insert timestamp with time zone, date_update timestamp with time zone, length double precision, ascent integer, descent integer, min_elevation integer, max_elevation integer, source_id integer, stake_id integer, departure character varying, arrival character varying, comfort_id integer, slope double precision, geom geometry, visible boolean, eid character varying, draft boolean, uuid uuid, source integer, target integer, provider_id integer, length_2d double precision)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'geotrek', 'public', 'pg_temp'
AS $function$
    SELECT 
        id, structure_id, "valid", "name", "comments", 
        date_insert, date_update, length, ascent, descent, 
        min_elevation, max_elevation, source_id, stake_id, 
        departure, arrival, comfort_id, slope, geom, 
        visible, eid, draft, "uuid", "source", "target", 
        provider_id, length_2d
    FROM geotrek.core_path;
$function$
;


-- Table t_infos_sentiers_ponctuel contenant les informations ponctuelles sur les sentiers

CREATE TABLE sentier.t_infos_sentiers_ponctuel (
	id serial4 NOT NULL,
	geom public.geometry(point, 2154) NULL,
	etat varchar NULL,
	"name" varchar NULL,
	description varchar NULL,
	CONSTRAINT t_infos_sentiers_ponctuel_pkey PRIMARY KEY (id)
);
CREATE INDEX sidx_t_infos_sentiers_ponctuel_geom ON sentier.t_infos_sentiers_ponctuel USING gist (geom);

-- Création de la table tr_nomenclature_troncon_extra contenant la nomenclature des états des tronçons de sentiers

CREATE TABLE sentier.tr_nomenclature_troncon_extra (
	id serial4 NOT NULL,
	code text NOT NULL,
	libelle text NOT NULL,
	description text NULL,
	actif bool DEFAULT true NULL,
	CONSTRAINT tr_nomenclature_troncon_extra_code_key UNIQUE (code),
	CONSTRAINT tr_nomenclature_troncon_extra_pkey PRIMARY KEY (id)
);
CREATE INDEX idx_nomenclature_libelle ON sentier.tr_nomenclature_troncon_extra USING btree (libelle);


-- Table t_troncons_geotrek_extra contenant les informations supplémentaires sur les tronçons de sentiers

CREATE TABLE sentier.t_troncons_geotrek_extra (
	id_troncon int4 NOT NULL,
	id_etat int4 NULL,
	affichage_principal text NULL,
	description text NULL,
	CONSTRAINT t_troncons_geotrek_extra_pkey PRIMARY KEY (id_troncon),
	CONSTRAINT t_troncons_geotrek_extra_id_etat_fkey FOREIGN KEY (id_etat) REFERENCES sentier.tr_nomenclature_troncon_extra(id)
);

-- Vue sentier.troncons_geotrek contenant les sentiers geotrek avec les informations supplémentaires

CREATE OR REPLACE VIEW sentier.troncons_geotrek
AS SELECT g.id,
    g.structure_id,
    g.valid,
    g.name,
    g.comments,
    g.date_insert,
    g.date_update,
    g.length,
    g.ascent,
    g.descent,
    g.min_elevation,
    g.max_elevation,
    g.source_id,
    g.stake_id,
    g.departure,
    g.arrival,
    g.comfort_id,
    g.slope,
    g.geom,
    g.visible,
    g.eid,
    g.draft,
    g.uuid,
    g.source,
    g.target,
    g.provider_id,
    g.length_2d,
    n.libelle AS etat,
    e.affichage_principal AS tooltip_name,
    e.description AS tooltip_description
   FROM geotrek.get_core_path_secured() g(id, structure_id, valid, name, comments, date_insert, date_update, length, ascent, descent, min_elevation, max_elevation, source_id, stake_id, departure, arrival, comfort_id, slope, geom, visible, eid, draft, uuid, source, target, provider_id, length_2d)
     LEFT JOIN sentier.t_troncons_geotrek_extra e ON e.id_troncon = g.id
     LEFT JOIN sentier.tr_nomenclature_troncon_extra n ON n.id = e.id_etat;


-- fonction qui permet de synchroniser les informations supplémentaires des tronçons de sentiers avec la table t_troncons_geotrek_extra

CREATE OR REPLACE FUNCTION sentier.trg_troncons_geotrek()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
DECLARE
    v_id_etat integer;
BEGIN

    IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN

        -- Résolution de l'état une seule fois
        SELECT id INTO v_id_etat
        FROM sentier.tr_nomenclature_troncon_extra 
        WHERE libelle = CASE lower(NEW.etat)
            WHEN 'ouvert'    THEN 'Ouvert'
            WHEN 'desordres' THEN 'Désordres'
            WHEN 'désordres' THEN 'Désordres'
            WHEN 'travaux'   THEN 'Travaux'
            WHEN 'ferme'     THEN 'Fermé'
            WHEN 'fermé'     THEN 'Fermé'
            ELSE NULL
        END;

        INSERT INTO sentier.t_troncons_geotrek_extra (id_troncon, id_etat, affichage_principal, description)
        VALUES (NEW.id, v_id_etat, NEW.tooltip_name, NEW.tooltip_description)
        ON CONFLICT (id_troncon) DO UPDATE SET
            id_etat             = EXCLUDED.id_etat,
            affichage_principal = EXCLUDED.affichage_principal,
            description         = EXCLUDED.description;

        RETURN NEW;

    ELSIF TG_OP = 'DELETE' THEN
        DELETE FROM sentier.t_troncons_geotrek_extra WHERE id_troncon = OLD.id;
        RETURN OLD;
    END IF;

END;
$function$
;


-- fonction de notification de modification de la table t_troncons_geotrek_extra pour l'export des données vers le serveur media.mercantour.eu

CREATE OR REPLACE FUNCTION sentier.trg_export_troncons()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
    PERFORM pg_notify('export_troncons', 'modified');
    RETURN NEW;
END;
$function$
;

-- fonction de notification de modification de la table t_infos_sentiers_ponctuel pour l'export des données vers le serveur media.mercantour.eu

CREATE OR REPLACE FUNCTION sentier.trg_export_points()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
    PERFORM pg_notify('export_points', 'modified');
    RETURN NEW;
END;
$function$
;

-- Trigger pour synchroniser les informations supplémentaires des tronçons de sentiers avec la table t_troncons_geotrek_extra

create trigger trg_troncons_geotrek_instead instead of
insert
    or
delete
    or
update
    on
    sentier.troncons_geotrek for each row execute function sentier.trg_troncons_geotrek();


-- trigger de notification de modification de la table t_infos_sentiers_ponctuel pour l'export des données vers le serveur media.mercantour.eu

create trigger trg_export_notify_points_change after
insert
    or
delete
    or
update
    on
    sentier.t_infos_sentiers_ponctuel for each statement execute function sentier.trg_export_points();



-- trigger de notification de modification de la table t_troncons_geotrek_extra pour l'export des données vers le serveur media.mercantour.eu

create trigger trg_export_notify_extra after
insert
    or
delete
    or
update
    on
    sentier.t_troncons_geotrek_extra for each statement execute function sentier.trg_export_troncons();


