CREATE OR REPLACE FUNCTION public.reserve_order_slot(
  p_order_id uuid,
  p_reserved_date date,
  p_time_slot reservation_time_slot,
  p_status reservation_status DEFAULT 'confirmed'::reservation_status,
  p_notes text DEFAULT NULL::text,
  p_default_cap integer DEFAULT 3
)
RETURNS public.reservations
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
DECLARE
  v_order_status text;
  v_next_order_status text;
  v_config record;
  v_global_cap int;
  v_reservation_count int := 0;
  v_job_count int := 0;
  v_cap int := p_default_cap;
  v_start timestamptz;
  v_end timestamptz;
  v_reservation public.reservations;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended(p_reserved_date::text || ':' || p_time_slot::text, 0));

  SELECT status INTO v_order_status
  FROM public.orders
  WHERE id = p_order_id;

  IF v_order_status IS NULL THEN
    RAISE EXCEPTION 'ORDER_NOT_FOUND';
  END IF;

  SELECT cap_value INTO v_global_cap
  FROM public.slot_configs
  WHERE type = 'cap'
  ORDER BY updated_at DESC
  LIMIT 1;

  v_cap := COALESCE(v_global_cap, p_default_cap);

  SELECT * INTO v_config
  FROM public.slot_configs
  WHERE date = p_reserved_date
    AND type = 'date';

  IF COALESCE(v_config.blocked, false) THEN
    RAISE EXCEPTION 'SLOT_CLOSED';
  END IF;

  IF p_status = 'confirmed' AND p_time_slot IN ('morning', 'afternoon') THEN
    v_cap := CASE
      WHEN p_time_slot = 'morning' THEN COALESCE(v_config.morning_cap, v_cap)
      ELSE COALESCE(v_config.afternoon_cap, v_cap)
    END;

    IF p_time_slot = 'morning' THEN
      v_start := p_reserved_date::timestamp AT TIME ZONE 'Asia/Seoul';
      v_end := (p_reserved_date::timestamp + interval '13 hours') AT TIME ZONE 'Asia/Seoul';
    ELSE
      v_start := (p_reserved_date::timestamp + interval '13 hours') AT TIME ZONE 'Asia/Seoul';
      v_end := (p_reserved_date::timestamp + interval '1 day') AT TIME ZONE 'Asia/Seoul';
    END IF;

    SELECT COUNT(*) INTO v_job_count
    FROM public.jobs
    WHERE status <> 'cancelled'
      AND scheduled_at IS NOT NULL
      AND scheduled_at >= v_start
      AND scheduled_at < v_end;

    SELECT COUNT(*) INTO v_reservation_count
    FROM public.reservations
    WHERE reserved_date = p_reserved_date
      AND time_slot = p_time_slot
      AND status = 'confirmed';

    IF v_job_count + v_reservation_count >= v_cap THEN
      RAISE EXCEPTION 'SLOT_FULL';
    END IF;
  END IF;

  INSERT INTO public.reservations(order_id, reserved_date, time_slot, status, notes)
  VALUES (p_order_id, p_reserved_date, p_time_slot, p_status, p_notes)
  RETURNING * INTO v_reservation;

  v_next_order_status := CASE
    WHEN v_order_status IN ('paid', 'preparing', 'in_service', 'completed', 'cancelled') THEN v_order_status
    WHEN p_status = 'confirmed' THEN 'reservation_confirmed'
    ELSE 'reservation_pending'
  END;

  UPDATE public.orders
  SET status = v_next_order_status,
      scheduled_date = p_reserved_date
  WHERE id = p_order_id;

  UPDATE public.jobs
  SET status = 'scheduled',
      scheduled_date = p_reserved_date
  WHERE order_id = p_order_id;

  RETURN v_reservation;
END;
$function$;
