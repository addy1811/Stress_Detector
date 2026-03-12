import numpy as np

def extract_features(events, sequence_length=100):
    hold_durations = []
    latencies = []
    error_counts = 0

    last_press_time = None
    press_stack = []

    for event in events:
        event_type, key, ts = event
        if event_type == 'press':
            if last_press_time is not None:
                latencies.append(ts - last_press_time)
            last_press_time = ts
            press_stack.append((key, ts))
            if hasattr(key, "char") and key.char == "\b":
                error_counts += 1
        elif event_type == 'release':
            for i in range(len(press_stack) - 1, -1, -1):
                if press_stack[i][0] == key:
                    hold_durations.append(ts - press_stack[i][1])
                    press_stack.pop(i)
                    break
                
    while len(hold_durations) < sequence_length:
        hold_durations.append(0.0)
    hold_durations = hold_durations[:sequence_length]

    while len(latencies) < sequence_length:
        latencies.append(0.0)
    latencies = latencies[:sequence_length]

    error_rate = [error_counts/sequence_length] * sequence_length

    return np.column_stack([hold_durations, latencies, error_rate])
