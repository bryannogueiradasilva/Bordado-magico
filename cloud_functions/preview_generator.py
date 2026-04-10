import os
import io
import base64
from google.cloud import storage
from google.cloud import firestore
import pyembroidery
from PIL import Image, ImageDraw

# Initialize clients
storage_client = storage.Client()
db = firestore.Client()

def generate_embroidery_preview(event, context):
    """
    Triggered by a change to a Cloud Storage bucket.
    Generates a PNG preview for .PES and .JEF files.
    """
    file_data = event
    file_name = file_data['name']
    bucket_name = file_data['bucket']

    if not (file_name.lower().endswith('.pes') or file_name.lower().endswith('.jef')):
        return

    print(f"Processing embroidery file: {file_name}")

    # Download file from GCS
    bucket = storage_client.bucket(bucket_name)
    blob = bucket.blob(file_name)
    file_bytes = blob.download_as_bytes()

    # Parse embroidery file using pyembroidery
    pattern = pyembroidery.read(io.BytesIO(file_bytes))
    
    if not pattern:
        print(f"Failed to parse pattern for {file_name}")
        return

    # Render pattern to PNG
    # We simulate stitch thickness by drawing lines for each stitch
    width, height = 1000, 1000
    image = Image.new('RGBA', (width, height), (0, 0, 0, 0))
    draw = ImageDraw.Draw(image)

    # Get pattern bounds to center it
    bounds = pattern.bounds() # [min_x, min_y, max_x, max_y]
    p_width = bounds[2] - bounds[0]
    p_height = bounds[3] - bounds[1]
    
    if p_width == 0 or p_height == 0:
        return

    scale = min((width - 100) / p_width, (height - 100) / p_height)
    offset_x = (width / 2) - ((bounds[0] + bounds[2]) / 2 * scale)
    offset_y = (height / 2) - ((bounds[1] + bounds[3]) / 2 * scale)

    # Draw stitches
    last_pos = None
    for stitch in pattern.stitches:
        x, y, data = stitch
        # pyembroidery data: 0=stitch, 1=jump, 2=trim, 3=stop, 4=end
        px = x * scale + offset_x
        py = y * scale + offset_y
        
        if last_pos and (data & 0xFF) == 0: # Normal stitch
            # Draw line with some thickness to simulate thread
            draw.line([last_pos, (px, py)], fill=(244, 114, 182, 255), width=3)
        
        last_pos = (px, py)

    # Save preview to GCS
    # Use the basename of the file to avoid nested folders in the preview bucket
    base_name = os.path.basename(file_name)
    preview_name = f"imagens-vitrine/{os.path.splitext(base_name)[0]}.png"
    preview_blob = bucket.blob(preview_name)
    
    img_byte_arr = io.BytesIO()
    image.save(img_byte_arr, format='PNG')
    preview_blob.upload_from_string(img_byte_arr.getvalue(), content_type='image/png')
    preview_url = f"https://storage.googleapis.com/{bucket_name}/{preview_name}"

    # Update Firestore / Database
    # Assuming products are indexed by their original filename
    products_ref = db.collection('products')
    query = products_ref.where('fileName', '==', file_name).limit(1).stream()
    
    for doc in query:
        doc.reference.update({
            'imageUrl': preview_url,
            'previewGenerated': True
        })
        print(f"Updated product {doc.id} with preview URL")

    print(f"Preview generated and saved for {file_name}")

# For Bulk Processing (Local Script Example)
def bulk_process(bucket_name):
    bucket = storage_client.bucket(bucket_name)
    blobs = bucket.list_blobs()
    for blob in blobs:
        if blob.name.lower().endswith(('.pes', '.jef')):
            # Manually trigger the logic or call the function
            pass
