"""EXCLUSIVE chai set. Units authored in mm, exported in meters, +Y up.

Rebuild: pip install numpy trimesh manifold3d pillow
        python source/build_model.py
No reference pixels or lighting are baked into the ceramic materials.
"""
from pathlib import Path
import sys, json, struct, math

OUT = Path(__file__).resolve().parents[1]
WORKSPACE = OUT.parents[1]
if (WORKSPACE / '.tea-model-tools').exists():
    sys.path.insert(0, str(WORKSPACE / '.tea-model-tools'))

import numpy as np
import trimesh
from PIL import Image


def bezier(p0, p1, p2, p3, steps):
    t = np.linspace(0, 1, steps + 1)[:, None]
    return (1-t)**3*np.array(p0) + 3*(1-t)**2*t*np.array(p1) + 3*(1-t)*t*t*np.array(p2) + t**3*np.array(p3)


def profile(start, segments):
    pts = [np.array(start, dtype=float)]
    for a, b, end, steps in segments:
        pts.extend(bezier(pts[-1], a, b, end, steps)[1:])
    return np.array(pts)


def revolve(p, sectors=144):
    """Closed solids of revolution with single-vertex poles, no degenerate faces."""
    vertices, rings, faces = [], [], []
    for radius, height in p:
        if abs(radius) < 1e-8:
            rings.append([len(vertices)])
            vertices.append([0, height, 0])
        else:
            ring = []
            for j in range(sectors):
                angle = 2*math.pi*j/sectors
                ring.append(len(vertices))
                vertices.append([radius*math.cos(angle), height, radius*math.sin(angle)])
            rings.append(ring)
    for a, b in zip(rings[:-1], rings[1:]):
        for j in range(sectors):
            k = (j+1) % sectors
            if len(a) == 1:
                faces.append([a[0], b[j], b[k]])
            elif len(b) == 1:
                faces.append([a[j], b[0], a[k]])
            else:
                faces.extend([[a[j], b[j], b[k]], [a[j], b[k], a[k]]])
    mesh = trimesh.Trimesh(vertices=np.array(vertices), faces=np.array(faces), process=True)
    mesh.fix_normals()
    return mesh


def handle():
    # Oval, right-side loop, with gently flared ceramic roots embedded in the wall.
    upper = bezier([47.7,65.0], [60,67.8], [75,66], [74,51], 38)
    lower = bezier([74,51], [74,36], [54,24], [40,24], 42)
    center = np.vstack((upper, lower[1:]))
    tangent = np.gradient(center, axis=0)
    tangent /= np.linalg.norm(tangent, axis=1)[:, None]
    vertices, faces, sectors = [], [], 24
    for i, (c, d) in enumerate(zip(center, tangent)):
        t = i/(len(center)-1)
        radius = 3.8 + 1.0*math.exp(-(t/.10)**2) + .9*math.exp(-((1-t)/.10)**2)
        normal = np.array([-d[1], d[0], 0])
        for j in range(sectors):
            a = 2*math.pi*j/sectors
            v = np.array([c[0], c[1], 0]) + radius*math.cos(a)*normal + np.array([0,0,radius*.94*math.sin(a)])
            vertices.append(v)
    for i in range(len(center)-1):
        for j in range(sectors):
            k=(j+1)%sectors; a=i*sectors+j; b=i*sectors+k
            faces.extend([[a,b,b+sectors],[a,b+sectors,a+sectors]])
    for row in [0, len(center)-1]:
        pole=len(vertices); vertices.append([*center[row],0])
        for j in range(sectors):
            faces.append([pole,row*sectors+j,row*sectors+(j+1)%sectors])
    mesh=trimesh.Trimesh(vertices=vertices,faces=faces,process=True)
    mesh.fix_normals()
    return mesh


def soften_handle_roots(mesh):
    """Local ceramic fillets; keep the inner bowl, rim, and contact foot fixed."""
    v=np.asarray(mesh.vertices).copy()
    radial=np.sqrt(v[:,0]**2+v[:,2]**2)
    outside=np.interp(v[:,1],[18,24,30,40,50,60,68,78],[38,41,43.4,46.5,48.5,49.7,50,50])
    roots=np.array([[49.5,65,0],[42,24,0]])
    distance=np.min(np.linalg.norm(v[:,None,:]-roots[None,:,:],axis=2),axis=1)
    weight=np.clip(1-(distance/10)**2,0,1)**2
    weight*=np.clip((radial-outside+1.0)/1.8,0,1)
    lap=trimesh.smoothing.laplacian_calculation(mesh,equal_weight=True)
    for _ in range(24):
        v += .32*weight[:,None]*(lap.dot(v)-v)
    mesh.vertices=v
    mesh.fix_normals()
    return mesh


cup_profile = profile([0,6.0], [
    ([8,6],[18,6],[23,6],2),
    ([24.5,6],[24.2,4],[25.7,4],4),
    ([26.3,4],[27.5,4],[28,4],2),
    ([29.5,4],[29.8,6],[30.4,7.5],4),
    ([32.2,11],[36.9,14.2],[39.7,21.2],8),
    ([45.8,33],[49.4,48],[49.9,64],12),
    ([50.0,68.5],[50,73],[50,76.0],5),
    ([50,78.3],[46.6,78.3],[46.6,76.0],8),
    ([46.6,71],[46.5,64],[46.2,59],5),
    ([45.4,42],[40.9,27],[36,20.0],10),
    ([31.7,14],[26,13.4],[21,13.4],7),
    ([15,13.4],[7,13.4],[0,13.4],3),
])

saucer_profile = profile([0,2.0], [
    ([12,2],[30,2],[39,2],3),
    ([42,2],[42.3,0],[44.2,0],4),
    ([45,0],[46.5,0],[47.2,0],2),
    ([49,0],[48.4,2.1],[51,2.6],4),
    ([62,4.7],[73,7.6],[79.6,11.0],10),
    ([83.1,12.6],[82.5,14.3],[80.2,13.7],6),
    ([69,10.7],[59,4.5],[45,4.1],12),
    ([39,4.0],[34,4],[30,4],4),
    ([22,4],[10,4],[0,4],4),
])

tea_profile = profile([0,13.85], [
    ([9,13.85],[16,13.85],[21,13.85],2),
    ([28,13.85],[32,16],[35.3,20.4],4),
    ([40,28],[44.8,43],[45.75,59],6),
    ([46.1,65],[46.13,70],[46.13,72.55],3),
    ([46,72.55],[45.9,72.17],[45.55,72.12],4),
    ([45.0,72.05],[44.1,72.05],[43.3,72.05],3),
    ([32,72.05],[13,72.05],[0,72.05],8),
])


def srgb_linear(rgb):
    x=np.array(rgb)/255
    return np.where(x<=.04045,x/12.92,((x+.055)/1.055)**2.4).tolist()


def make_tea_texture():
    """Only subtle cream/albedo variation; no directional highlights or shadows."""
    n=1024
    yy,xx=np.mgrid[0:n,0:n]
    x=(xx+.5-n/2)/(n/2); z=(yy+.5-n/2)/(n/2)
    r=np.sqrt(x*x+z*z); theta=np.arctan2(z,x)
    phase=theta-13*r
    swirl=(.5+.5*np.cos(phase))**15
    mask=np.exp(-((r-.38)/.26)**4)*(1-np.exp(-r*r/.003))
    cream=.13*swirl*mask
    base=np.array([183,126,77],dtype=float)
    light=np.array([226,191,146],dtype=float)
    rgb=base[None,None,:]*(1-cream[:,:,None])+light[None,None,:]*cream[:,:,None]
    rng=np.random.default_rng(15)
    rgb+=rng.normal(0,.15,(n,n,1))
    Image.fromarray(np.uint8(np.clip(rgb,0,255))).save(OUT/'textures'/'chai-basecolor.png',optimize=True)


def write_glb(meshes):
    chunks=[]; views=[]; accessors=[]
    def append_blob(blob,target=None):
        offset=sum(len(v) for v in chunks)
        views.append({'buffer':0,'byteOffset':offset,'byteLength':len(blob),**({'target':target} if target else {})})
        chunks.append(blob+b'\0'*((-len(blob))%4))
        return len(views)-1
    def accessor(arr,ctype,kind,target):
        v=append_blob(arr.tobytes(),target)
        item={'bufferView':v,'componentType':ctype,'count':len(arr),'type':kind}
        if kind=='VEC3':
            item.update(min=arr.min(axis=0).tolist(),max=arr.max(axis=0).tolist())
        accessors.append(item)
        return len(accessors)-1

    doc={'asset':{'version':'2.0','generator':'EXCLUSIVE / procedural reference reconstruction'},
         'scene':0,'scenes':[{'name':'EXCLUSIVE_TEA','nodes':[0]}],
         'nodes':[{'name':'EXCLUSIVE_TEA','children':[1,2,3]}], 'meshes':[],
         'materials':[
             {'name':'Midnight_Plum_Ceramic','pbrMetallicRoughness':{'baseColorFactor':srgb_linear([35,26,43])+[1], 'metallicFactor':0,'roughnessFactor':.28},
              'extensions':{'KHR_materials_clearcoat':{'clearcoatFactor':.18,'clearcoatRoughnessFactor':.22}},'doubleSided':False},
             {'name':'Warm_Milk_Chai','pbrMetallicRoughness':{'baseColorFactor':[1,1,1,1],'baseColorTexture':{'index':0},'metallicFactor':0,'roughnessFactor':.29},'doubleSided':False}],
         'extensionsUsed':['KHR_materials_clearcoat'],
         'samplers':[{'magFilter':9729,'minFilter':9987,'wrapS':33071,'wrapT':33071}],
         'textures':[{'source':0,'sampler':0}], 'images':[],
         'extras':{'units':'meters','upAxis':'+Y','handleDirection':'+X','steam':'omitted; add independent runtime effect','pivot':'all nodes at common world origin, saucer on ground Y=0'}}
    for name,mesh in meshes.items():
        pos=np.asarray(mesh.vertices,dtype='<f4')
        normals=np.asarray(mesh.vertex_normals,dtype='<f4')
        idx=np.asarray(mesh.faces.reshape(-1),dtype='<u2' if len(pos)<65536 else '<u4')
        attrs={'POSITION':accessor(pos,5126,'VEC3',34962),'NORMAL':accessor(normals,5126,'VEC3',34962)}
        if name=='Tea':
            uv=np.column_stack((pos[:,0]/.094+.5,.5-pos[:,2]/.094)).astype('<f4')
            attrs['TEXCOORD_0']=accessor(uv,5126,'VEC2',34962)
        prim={'attributes':attrs,'indices':accessor(idx,5123 if idx.dtype.itemsize==2 else 5125,'SCALAR',34963),'material':1 if name=='Tea' else 0,'mode':4}
        i=len(doc['meshes']); doc['meshes'].append({'name':name,'primitives':[prim]})
        doc['nodes'].append({'name':name,'mesh':i})
    image_view=append_blob((OUT/'textures'/'chai-basecolor.png').read_bytes())
    doc['images'].append({'name':'Chai_Subtle_Cream_Albedo','bufferView':image_view,'mimeType':'image/png'})
    binary=b''.join(chunks)
    doc.update(buffers=[{'byteLength':len(binary)}],bufferViews=views,accessors=accessors)
    js=json.dumps(doc,separators=(',',':')).encode(); js+=b' '*((-len(js))%4)
    glb=struct.pack('<III',0x46546C67,2,12+8+len(js)+8+len(binary))+struct.pack('<II',len(js),0x4E4F534A)+js+struct.pack('<II',len(binary),0x004E4942)+binary
    (OUT/'exclusive-tea.glb').write_bytes(glb)


def write_obj(meshes):
    lines=['# EXCLUSIVE chai set; meters; Y-up. Handle joined to Cup.','mtllib exclusive-tea.mtl']
    v_offset=0
    for name,mesh in meshes.items():
        lines+=['o '+name,'usemtl '+('Chai' if name=='Tea' else 'Ceramic'),'s 1']
        p=np.asarray(mesh.vertices); n=mesh.vertex_normals
        lines += ['v %.8f %.8f %.8f'%tuple(v) for v in p]
        lines += ['vt %.7f %.7f'%(v[0]/.094+.5,.5+v[2]/.094) for v in p]
        lines += ['vn %.7f %.7f %.7f'%tuple(v) for v in n]
        for face in mesh.faces:
            indexes=[int(i)+1+v_offset for i in face]
            lines.append('f '+' '.join(f'{i}/{i}/{i}' for i in indexes))
        v_offset+=len(p)
    (OUT/'exclusive-tea.obj').write_text('\n'.join(lines),encoding='utf8')
    (OUT/'exclusive-tea.mtl').write_text('newmtl Ceramic\nKd 0.137255 0.101961 0.168627\nKs 0.12 0.12 0.12\nNs 120\nNi 1.5\nd 1\nillum 2\n\nnewmtl Chai\nKd 1 1 1\nKs 0.08 0.08 0.08\nNs 80\nNi 1.33\nd 1\nillum 2\nmap_Kd textures/chai-basecolor.png\n',encoding='utf8')


def main():
    (OUT/'textures').mkdir(parents=True,exist_ok=True)
    shell=revolve(cup_profile)
    loop=handle()
    print('Boolean joining handle to hollow cup...',flush=True)
    cup=trimesh.boolean.union([shell,loop],engine='manifold')
    cup=soften_handle_roots(cup)
    meshes={'Cup':cup,'Tea':revolve(tea_profile),'Saucer':revolve(saucer_profile)}
    report={'units':'meters','axis':'Y-up','steam_included':False,'meshes':{}}
    for name,mesh in meshes.items():
        mesh.apply_scale(.001)
        e=mesh.edges_sorted
        _,counts=np.unique(e,axis=0,return_counts=True)
        stats={'vertices':len(mesh.vertices),'triangles':len(mesh.faces),'watertight':bool(mesh.is_watertight),
               'consistent_winding':bool(mesh.is_winding_consistent),'positive_volume':bool(mesh.volume>0),
               'connected_components':len(mesh.split(only_watertight=False)),
               'boundary_or_nonmanifold_edges':int(np.count_nonzero(counts!=2)),
               'degenerate_faces':int(np.count_nonzero(mesh.area_faces<1e-14)),
               'bounds_m':mesh.bounds.tolist(),'volume_ml':float(mesh.volume*1e6)}
        assert stats['watertight'] and stats['consistent_winding'] and stats['positive_volume'],(name,stats)
        assert stats['boundary_or_nonmanifold_edges']==0 and stats['degenerate_faces']==0 and stats['connected_components']==1,(name,stats)
        report['meshes'][name]=stats
    # Exact volumetric intersection checks, not bounding-box overlap.
    report['pairwise_overlap_mm3']={}
    for a,b in [('Cup','Tea'),('Cup','Saucer'),('Tea','Saucer')]:
        intersection=trimesh.boolean.intersection([meshes[a],meshes[b]],engine='manifold')
        volume=0 if intersection.is_empty else abs(float(intersection.volume))*1e9
        report['pairwise_overlap_mm3'][a+'_'+b]=volume
        assert volume<.01,(a,b,volume,intersection.bounds.tolist())
    report['total_triangles']=sum(len(m.faces) for m in meshes.values())
    assert 20000 <= report['total_triangles'] <= 60000
    make_tea_texture()
    write_glb(meshes)
    write_obj(meshes)
    report['glb_bytes']=(OUT/'exclusive-tea.glb').stat().st_size
    (OUT/'geometry-report.json').write_text(json.dumps(report,indent=2),encoding='utf8')
    print(json.dumps(report,indent=2),flush=True)


if __name__=='__main__':
    main()
