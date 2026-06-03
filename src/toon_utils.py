import re

def encode_property_data(data):
    """
    Encodes property data dict into TOON format:
    price: ...
    location: ...
    description: ...
    images[5]:
      url1
      url2
      ...
    """
    lines = []
    lines.append(f"price: {data.get('price', '')}")
    lines.append(f"location: {data.get('location', '')}")
    # Escape description newlines just in case
    desc = data.get('description', '').replace('\n', ' ')
    lines.append(f"description: {desc}")
    
    images = data.get('images', [])
    lines.append(f"images[{len(images)}]:")
    for img in images:
        lines.append(f"  {img}")
    return "\n".join(lines)

def decode_property_data(toon_str):
    """
    Decodes property data from TOON format.
    """
    data = {
        "price": "",
        "location": "",
        "description": "",
        "images": []
    }
    lines = toon_str.strip().split("\n")
    in_images = False
    
    for line in lines:
        if not line:
            continue
        
        # Check indentation for image list
        if in_images:
            if line.startswith("  "):
                data["images"].append(line.strip())
                continue
            else:
                in_images = False
                
        # Parse scalar fields or header of images list
        match = re.match(r"^([a-zA-Z0-9_]+)(?:\[\d+\])?:?\s*(.*)$", line.strip())
        if match:
            key, val = match.groups()
            if key == "price":
                data["price"] = val.strip()
            elif key == "location":
                data["location"] = val.strip()
            elif key == "description":
                data["description"] = val.strip()
            elif key == "images":
                in_images = True
    return data

def encode_timing_data(words):
    """
    Encodes list of word dicts into TOON format:
    words[3]{word,start,end}:
      Hello,0.1,0.5
      world,0.5,0.9
      this,0.9,1.2
    """
    lines = []
    lines.append(f"words[{len(words)}]{{word,start,end}}:")
    for w in words:
        # Clean word to avoid comma errors (e.g. remove commas or escape them)
        word = w.get('word', '').replace(',', '')
        start = w.get('start', 0.0)
        end = w.get('end', 0.0)
        lines.append(f"  {word},{start},{end}")
    return "\n".join(lines)

def decode_timing_data(toon_str):
    """
    Decodes timing data from TOON format.
    """
    words = []
    lines = toon_str.strip().split("\n")
    if not lines:
        return words
        
    for line in lines:
        stripped = line.strip()
        if not stripped or stripped.startswith("words["):
            continue
        # Split by comma
        parts = stripped.split(",")
        if len(parts) >= 3:
            words.append({
                "word": parts[0].strip(),
                "start": float(parts[1].strip()),
                "end": float(parts[2].strip())
            })
    return words

def encode_topic_data(data):
    """
    Encodes topic data into TOON format:
    topic: ...
    concepts[N]:
      name|emoji|color|description
    """
    lines = []
    lines.append(f"topic: {data.get('topic', '')}")
    concepts = data.get('concepts', [])
    lines.append(f"concepts[{len(concepts)}]:")
    for c in concepts:
        desc = c.get('description', '').replace('\n', ' ').replace('|', '')
        lines.append(f"  {c.get('name', '')}|{c.get('emoji', '')}|{c.get('color', '')}|{desc}")
    return "\n".join(lines)

def decode_topic_data(toon_str):
    """
    Decodes topic data from TOON format.
    """
    data = {
        "topic": "",
        "concepts": []
    }
    lines = toon_str.strip().split("\n")
    in_concepts = False
    
    for line in lines:
        if not line:
            continue
        
        if in_concepts:
            if line.startswith("  "):
                parts = line.strip().split("|")
                if len(parts) >= 4:
                    data["concepts"].append({
                        "name": parts[0].strip(),
                        "emoji": parts[1].strip(),
                        "color": parts[2].strip(),
                        "description": parts[3].strip()
                    })
                continue
            else:
                in_concepts = False
                
        match = re.match(r"^([a-zA-Z0-9_]+)(?:\[\d+\])?:?\s*(.*)$", line.strip())
        if match:
            key, val = match.groups()
            if key == "topic":
                data["topic"] = val.strip()
            elif key == "concepts":
                in_concepts = True
    return data

def encode_timing_with_concepts(concepts, words):
    """
    Encodes list of concept dicts and word dicts into TOON format:
    concepts[N]{name,start,end}:
      Name,start,end
    words[M]{word,start,end}:
      Word,start,end
    """
    lines = []
    lines.append(f"concepts[{len(concepts)}]{{name,start,end}}:")
    for c in concepts:
        name = c.get('name', '').replace(',', '')
        start = c.get('start', 0.0)
        end = c.get('end', 0.0)
        lines.append(f"  {name},{start},{end}")
        
    lines.append(f"words[{len(words)}]{{word,start,end}}:")
    for w in words:
        word = w.get('word', '').replace(',', '')
        start = w.get('start', 0.0)
        end = w.get('end', 0.0)
        lines.append(f"  {word},{start},{end}")
    return "\n".join(lines)

def decode_timing_with_concepts(toon_str):
    """
    Decodes timing and concepts from TOON format.
    """
    concepts = []
    words = []
    lines = toon_str.strip().split("\n")
    
    in_concepts = False
    in_words = False
    
    for line in lines:
        stripped = line.strip()
        if not stripped:
            continue
        if stripped.startswith("concepts["):
            in_concepts = True
            in_words = False
            continue
        if stripped.startswith("words["):
            in_concepts = False
            in_words = True
            continue
            
        parts = stripped.split(",")
        if len(parts) >= 3:
            if in_concepts:
                concepts.append({
                    "name": parts[0].strip(),
                    "start": float(parts[1].strip()),
                    "end": float(parts[2].strip())
                })
            elif in_words:
                words.append({
                    "word": parts[0].strip(),
                    "start": float(parts[1].strip()),
                    "end": float(parts[2].strip())
                })
    return {"concepts": concepts, "words": words}


